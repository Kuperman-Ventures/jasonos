"use server";

import { revalidatePath } from "next/cache";
import {
  createPublicClient,
  createPublicServiceRoleClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import type { BoardingItem, HoldingItem, Urgency } from "@/lib/integrations/inbox-triage";

export type SavedBoarding = {
  kind: "boarding";
  savedAt: string;
  item: BoardingItem;
};

export type SavedHolding = {
  kind: "holding";
  savedAt: string;
  item: HoldingItem;
};

export type SavedEntry = SavedBoarding | SavedHolding;

type Result = { ok: true } | { ok: false; error: string };

function hasConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function prefsUserId(
  db: ReturnType<typeof createPublicServiceRoleClient>
): Promise<string | null> {
  const configured = process.env.JASONOS_OWNER_USER_ID?.trim();
  if (configured) return configured;

  try {
    const sb = await createPublicClient();
    const { data, error } = await sb.auth.getUser();
    if (!error && data.user?.id) return data.user.id;
  } catch {
    // no auth context
  }

  const { data } = await db
    .from("user_preferences")
    .select("user_id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const fromPrefs = (data as { user_id?: string } | null)?.user_id ?? null;
  if (fromPrefs) return fromPrefs;

  try {
    const jasonosDb = createServiceRoleClient();
    const { data } = await jasonosDb
      .from("user_integrations")
      .select("user_id")
      .eq("provider", "google")
      .not("user_id", "is", null)
      .limit(1)
      .maybeSingle();
    return (data as { user_id?: string } | null)?.user_id ?? null;
  } catch {
    return null;
  }
}

function isUrgency(v: unknown): v is Urgency {
  return v === "now" || v === "soon" || v === "paid" || v === "normal";
}

function normalizeBoardingItem(raw: unknown): BoardingItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.threadId !== "string" ||
    typeof o.name !== "string" ||
    typeof o.subject !== "string"
  ) {
    return null;
  }
  return {
    threadId: o.threadId,
    name: o.name,
    email: typeof o.email === "string" ? o.email : "",
    subject: o.subject,
    receivedAt:
      typeof o.receivedAt === "string" ? o.receivedAt : new Date().toISOString(),
    appleMailUrl: typeof o.appleMailUrl === "string" ? o.appleMailUrl : null,
    elevator:
      typeof o.elevator === "string" && o.elevator.trim()
        ? o.elevator
        : o.subject,
    urgency: isUrgency(o.urgency) ? o.urgency : "normal",
    draft: typeof o.draft === "string" ? o.draft : "",
  };
}

function normalizeHoldingItem(raw: unknown): HoldingItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.threadId !== "string" ||
    typeof o.name !== "string" ||
    typeof o.subject !== "string"
  ) {
    return null;
  }
  return {
    threadId: o.threadId,
    name: o.name,
    subject: o.subject,
    appleMailUrl: typeof o.appleMailUrl === "string" ? o.appleMailUrl : null,
    ageDays: typeof o.ageDays === "number" ? o.ageDays : 0,
    note: typeof o.note === "string" ? o.note : "",
  };
}

function parseSavedEntries(raw: unknown): SavedEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const savedAt =
      typeof r.savedAt === "string" ? r.savedAt : new Date().toISOString();
    if (r.kind === "boarding") {
      const item = normalizeBoardingItem(r.item);
      if (item) out.push({ kind: "boarding", savedAt, item });
    } else if (r.kind === "holding") {
      const item = normalizeHoldingItem(r.item);
      if (item) out.push({ kind: "holding", savedAt, item });
    }
  }
  return out;
}

function parseDismissed(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
}

export async function getInboxDispatchPrefs(): Promise<{
  saved: SavedEntry[];
  dismissed: string[];
}> {
  if (!hasConfig()) return { saved: [], dismissed: [] };

  const db = createPublicServiceRoleClient();
  const userId = await prefsUserId(db);

  const { data, error } = userId
    ? await db
        .from("user_preferences")
        .select("inbox_dispatch_saved,inbox_dispatch_dismissed")
        .eq("user_id", userId)
        .maybeSingle()
    : await db
        .from("user_preferences")
        .select("inbox_dispatch_saved,inbox_dispatch_dismissed")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

  if (error || !data) return { saved: [], dismissed: [] };

  return {
    saved: parseSavedEntries(
      (data as { inbox_dispatch_saved?: unknown }).inbox_dispatch_saved
    ),
    dismissed: parseDismissed(
      (data as { inbox_dispatch_dismissed?: unknown }).inbox_dispatch_dismissed
    ),
  };
}

export async function setInboxDispatchPrefs(
  saved: SavedEntry[],
  dismissed: string[]
): Promise<Result> {
  if (!hasConfig()) return { ok: false, error: "Supabase is not configured." };

  const db = createPublicServiceRoleClient();
  const userId = await prefsUserId(db);
  if (!userId) {
    return { ok: false, error: "No user_preferences row — cannot save." };
  }

  const now = new Date().toISOString();
  const payload = {
    inbox_dispatch_saved: saved,
    inbox_dispatch_dismissed: dismissed,
    updated_at: now,
  };

  const { data: existing } = await db
    .from("user_preferences")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.user_id) {
    const { error } = await db
      .from("user_preferences")
      .update(payload)
      .eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await db
      .from("user_preferences")
      .insert([{ ...payload, user_id: userId }]);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true };
}

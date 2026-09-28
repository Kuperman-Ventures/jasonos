import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { etYmd } from "@/lib/dates";
import {
  fetchAccountCalendarEvents,
  type CalendarApiEvent,
} from "@/lib/integrations/google-calendar";
import { listGoogleAccessTokens } from "@/lib/integrations/google-tokens";
import type { BusyBlock } from "./types";
import { addCalendarDays, firstEligibleYmd, lastEligibleYmd, wallToUtc } from "./slots";
import type {
  BrowningNetworkingPage,
  HandoffBrief,
  HandoffRecord,
  HandoffSlot,
  HandoffStatus,
} from "./types";

export type { BusyBlock, BrowningNetworkingPage, HandoffRecord };

function hasConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function asSlots(value: unknown): HandoffSlot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.start !== "string" || typeof row.end !== "string") {
      return [];
    }
    return [{ id: row.id, start: row.start, end: row.end }];
  });
}

function asBrief(value: unknown): HandoffBrief | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.who !== "string" || typeof row.why !== "string") return null;
  const questions = Array.isArray(row.questions)
    ? row.questions.filter((q): q is string => typeof q === "string")
    : [];
  return {
    who: row.who,
    why: row.why,
    overlap: typeof row.overlap === "string" ? row.overlap : "",
    questions,
    ask: typeof row.ask === "string" ? row.ask : "",
  };
}

function mapRow(row: Record<string, unknown>): HandoffRecord {
  return {
    id: String(row.id),
    gmailAccount: String(row.gmail_account ?? ""),
    gmailThreadId: (row.gmail_thread_id as string | null) ?? null,
    subject: (row.subject as string | null) ?? null,
    receivedAt: (row.received_at as string | null) ?? null,
    contactName: (row.contact_name as string | null) ?? null,
    contactEmail: (row.contact_email as string | null) ?? null,
    contactPhone: (row.contact_phone as string | null) ?? null,
    linkedinUrl: (row.linkedin_url as string | null) ?? null,
    contactTitle: (row.contact_title as string | null) ?? null,
    contactCompany: (row.contact_company as string | null) ?? null,
    availabilityNote: (row.availability_note as string | null) ?? null,
    whyTheyReplied: (row.why_they_replied as string | null) ?? null,
    existingContactId: (row.existing_contact_id as string | null) ?? null,
    createdContactId: (row.created_contact_id as string | null) ?? null,
    slots: asSlots(row.slots),
    draftBody: (row.draft_body as string | null) ?? null,
    gmailDraftId: (row.gmail_draft_id as string | null) ?? null,
    gmailDraftUrl: (row.gmail_draft_url as string | null) ?? null,
    callTitle: (row.call_title as string | null) ?? null,
    callStartsAt: (row.call_starts_at as string | null) ?? null,
    callEndsAt: (row.call_ends_at as string | null) ?? null,
    brief: asBrief(row.brief),
    thankYouBody: (row.thank_you_body as string | null) ?? null,
    thankYouSource: (row.thank_you_source as string | null) ?? null,
    lastOutreachSubject: (row.last_outreach_subject as string | null) ?? null,
    lastOutreachSentAt: (row.last_outreach_sent_at as string | null) ?? null,
    status: (row.status as HandoffStatus) ?? "times_ready",
  };
}

export async function getBrowningNetworkingPage(): Promise<BrowningNetworkingPage> {
  const now = new Date();
  const eligibleYmd = firstEligibleYmd(now);
  const lastYmd = addCalendarDays(lastEligibleYmd(now), 7);
  const empty: BrowningNetworkingPage = {
    configured: hasConfig(),
    handoffs: [],
    busy: [],
    eligibleYmd,
    lastYmd,
  };
  if (!hasConfig()) {
    return { ...empty, error: "Supabase is not configured." };
  }

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("browning_handoffs")
    .select("*")
    .neq("status", "dismissed")
    .order("received_at", { ascending: false })
    .limit(100);
  if (error) {
    return { ...empty, error: error.message };
  }

  const busy = await loadBusy(eligibleYmd, lastYmd);
  return {
    ...empty,
    handoffs: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
    busy,
  };
}

export async function loadBusy(fromYmd: string, toYmd: string): Promise<BusyBlock[]> {
  const tokens = await listGoogleAccessTokens();
  if (!tokens.length) return [];
  const timeMin = wallToUtc(fromYmd, 0).toISOString();
  const timeMax = wallToUtc(toYmd, 23 * 60 + 59).toISOString();
  const lists = await Promise.all(
    tokens.map((account) =>
      fetchAccountCalendarEvents({
        token: account.token,
        timeMin,
        timeMax,
      }).catch(() => ({ events: [] as CalendarApiEvent[] }))
    )
  );
  const blocks: BusyBlock[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const event of list.events) {
      const block = eventToBusy(event);
      if (!block) continue;
      const key = `${block.title}|${block.start}|${block.end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      blocks.push(block);
    }
  }
  return blocks;
}

function eventToBusy(event: CalendarApiEvent): BusyBlock | null {
  if (event.status === "cancelled") return null;
  const title = event.summary?.trim() || "Busy";
  if (event.start?.date && !event.start.dateTime) {
    return {
      title,
      start: event.start.date,
      end: event.end?.date || event.start.date,
      allDay: true,
    };
  }
  if (!event.start?.dateTime || !event.end?.dateTime) return null;
  return { title, start: event.start.dateTime, end: event.end.dateTime };
}

export function schedulingWindowYmd(now = new Date()): { fromYmd: string; toYmd: string } {
  return {
    fromYmd: etYmd(now),
    toYmd: addCalendarDays(lastEligibleYmd(now), 7),
  };
}

// Published Inbox Dispatch — the weekday morning triage agent writes one row
// per day into `inbox_dispatches`. The home card reads today's Eastern date,
// falling back to the most recent row when today's run hasn't landed yet.
//
// Why a publisher at all: the in-app engine (lib/integrations/inbox-triage.ts)
// is deliberately read-only — no Gmail compose scope — and bounded to the
// first MAX_THREAD_FETCHES threads of `in:inbox`. The publisher searches wider
// (threads that never got an INBOX label are routinely the ones that matter)
// and saves real reply drafts in Gmail. When it has run, its output wins.
//
// Any missing table / config / query failure returns null so the route can
// fall back to a live compute. This never throws.

import "server-only";
import {
  createPublicServiceRoleClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { etToday } from "@/lib/dates";
import type {
  InboxDispatch,
  BoardingItem,
  HoldingItem,
  NoiseGroup,
  Urgency,
} from "@/lib/integrations/inbox-triage";

type DispatchRow = {
  dispatch_date: string;
  payload: unknown;
  created_at: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = { from: (t: string) => any };

const URGENCIES: readonly Urgency[] = ["now", "soon", "paid", "normal"];

function hasConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** Publisher hrefs must be https Gmail URLs — never trust arbitrary JSON links. */
function gmailHref(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:") return undefined;
    if (u.hostname !== "mail.google.com" && !u.hostname.endsWith(".google.com")) {
      return undefined;
    }
    return s;
  } catch {
    return undefined;
  }
}

/**
 * Coerce an external publisher's JSON into the InboxDispatch shape the card
 * renders. Anything unrecognized is dropped rather than trusted — a malformed
 * row should degrade to an empty section, never crash the home page.
 */
function normalizePayload(raw: unknown): Omit<InboxDispatch, "source"> | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;

  const boarding: BoardingItem[] = Array.isArray(p.boarding)
    ? p.boarding.flatMap((b): BoardingItem[] => {
        if (!b || typeof b !== "object") return [];
        const i = b as Record<string, unknown>;
        const threadId = str(i.threadId);
        if (!threadId) return [];
        const urgency = URGENCIES.includes(i.urgency as Urgency)
          ? (i.urgency as Urgency)
          : "normal";
        return [
          {
            threadId,
            name: str(i.name, "your contact"),
            email: str(i.email),
            subject: str(i.subject, "(no subject)"),
            receivedAt: str(i.receivedAt),
            appleMailUrl: str(i.appleMailUrl) || null,
            gmailUrl: gmailHref(i.gmailUrl),
            elevator: str(i.elevator),
            urgency,
            draft: str(i.draft),
            draftSaved: i.draftSaved === true,
            draftUrl: gmailHref(i.draftUrl),
          },
        ];
      })
    : [];

  const holding: HoldingItem[] = Array.isArray(p.holding)
    ? p.holding.flatMap((h): HoldingItem[] => {
        if (!h || typeof h !== "object") return [];
        const i = h as Record<string, unknown>;
        const threadId = str(i.threadId);
        if (!threadId) return [];
        return [
          {
            threadId,
            name: str(i.name, "your contact"),
            subject: str(i.subject, "(no subject)"),
            appleMailUrl: str(i.appleMailUrl) || null,
            gmailUrl: gmailHref(i.gmailUrl),
            ageDays: typeof i.ageDays === "number" ? i.ageDays : 0,
            note: str(i.note),
          },
        ];
      })
    : [];

  const noise: NoiseGroup[] = Array.isArray(p.noise)
    ? p.noise.flatMap((n): NoiseGroup[] => {
        if (!n || typeof n !== "object") return [];
        const i = n as Record<string, unknown>;
        const label = str(i.label);
        if (!label) return [];
        return [
          {
            label,
            count: typeof i.count === "number" ? i.count : 0,
            approx: i.approx === true,
          },
        ];
      })
    : [];

  const noiseTotal =
    typeof p.noiseTotal === "number"
      ? p.noiseTotal
      : noise.reduce((sum, g) => sum + g.count, 0);

  return {
    configured: p.configured === false ? false : true,
    generatedAt: str(p.generatedAt),
    error: str(p.error) || undefined,
    boarding,
    holding,
    noise,
    noiseTotal,
  };
}

/** Today's row, else the most recent one. Null on empty / soft errors. */
async function fetchFrom(sb: Sb, today: string): Promise<InboxDispatch | null> {
  const cols = "dispatch_date,payload,created_at";

  const todayRes = await sb
    .from("inbox_dispatches")
    .select(cols)
    .eq("dispatch_date", today)
    .maybeSingle();
  if (todayRes.error) throw todayRes.error;

  let row = todayRes.data as DispatchRow | null;
  if (!row) {
    const latestRes = await sb
      .from("inbox_dispatches")
      .select(cols)
      .order("dispatch_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestRes.error) throw latestRes.error;
    row = latestRes.data as DispatchRow | null;
  }
  if (!row) return null;

  const base = normalizePayload(row.payload);
  if (!base) return null;

  return {
    ...base,
    generatedAt: base.generatedAt || row.created_at,
    source: "published",
    dispatchDate: row.dispatch_date,
    isStale: row.dispatch_date !== today,
  };
}

/**
 * The published dispatch for the home card, or null when the publisher hasn't
 * written one (or the table/config is missing) — in which case the caller
 * should fall back to the live engine.
 */
export async function getPublishedInboxDispatch(): Promise<InboxDispatch | null> {
  if (!hasConfig()) return null;
  const today = etToday();

  // Prefer public (where the external publisher lands), then the jasonos
  // schema. A missing table on either side is just "nothing published yet".
  try {
    const dispatch = await fetchFrom(createPublicServiceRoleClient(), today);
    if (dispatch) return dispatch;
  } catch (err) {
    console.warn("[inbox-dispatch] public.inbox_dispatches unavailable:", err);
  }

  try {
    return await fetchFrom(createServiceRoleClient(), today);
  } catch (err) {
    console.warn("[inbox-dispatch] jasonos.inbox_dispatches unavailable:", err);
    return null;
  }
}

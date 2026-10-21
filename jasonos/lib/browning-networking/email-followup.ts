// Match Waiting handoffs to Email Follow Ups rows so the Browning list
// can show that a nudge is already scheduled.

import { canonicalEmail } from "@/lib/outreach/contact-lookup";

export type BrowningEmailFollowUp = {
  status: "new" | "scheduled";
  followUpDue: string | null;
  followUpDays: number | null;
};

export type SentFollowupMatchRow = {
  status: string;
  follow_up_due: string | null;
  follow_up_days: number | null;
  to_line: string | null;
  recipients: unknown;
  account_email?: string | null;
};

function emailsFromRecipients(recipients: unknown): string[] {
  if (!Array.isArray(recipients)) return [];
  const out: string[] = [];
  for (const item of recipients) {
    if (!item || typeof item !== "object") continue;
    const email = (item as { email?: unknown }).email;
    if (typeof email === "string" && email.includes("@")) {
      out.push(canonicalEmail(email));
    }
  }
  return out;
}

/** True when this follow-up row was sent to the handoff contact. */
export function followupMatchesContactEmail(
  row: SentFollowupMatchRow,
  contactEmail: string | null | undefined
): boolean {
  const want = (contactEmail ?? "").trim();
  if (!want.includes("@")) return false;
  const key = canonicalEmail(want);
  if (emailsFromRecipients(row.recipients).includes(key)) return true;
  const toLine = (row.to_line ?? "").toLowerCase();
  return toLine.includes(key) || toLine.includes(want.toLowerCase());
}

export function toBrowningEmailFollowUp(
  row: SentFollowupMatchRow
): BrowningEmailFollowUp | null {
  if (row.status === "new") {
    return { status: "new", followUpDue: null, followUpDays: null };
  }
  if (row.status === "scheduled") {
    return {
      status: "scheduled",
      followUpDue: row.follow_up_due,
      followUpDays: row.follow_up_days,
    };
  }
  return null;
}

/** Prefer a scheduled row; otherwise a new (pick-a-day) row. */
export function pickFollowUpForContact(
  rows: SentFollowupMatchRow[],
  contactEmail: string | null | undefined
): BrowningEmailFollowUp | null {
  const matches = rows.filter((row) => followupMatchesContactEmail(row, contactEmail));
  if (!matches.length) return null;
  const scheduled = matches.find((row) => row.status === "scheduled");
  if (scheduled) return toBrowningEmailFollowUp(scheduled);
  const fresh = matches.find((row) => row.status === "new");
  return fresh ? toBrowningEmailFollowUp(fresh) : null;
}

export function emailFollowUpStatusLabel(
  followUp: BrowningEmailFollowUp | null | undefined,
  todayYmd: string
): string | null {
  if (!followUp) return null;
  if (followUp.status === "new") return "Email follow-up — pick a day";
  const due = followUp.followUpDue?.trim() || null;
  if (!due) {
    const days = followUp.followUpDays;
    return days ? `Follow-up scheduled · ${days}d` : "Follow-up scheduled";
  }
  const when = formatFollowUpDue(due);
  if (due <= todayYmd) return `Follow-up due · ${when}`;
  return `Follow-up scheduled · ${when}`;
}

function formatFollowUpDue(ymd: string): string {
  const t = Date.parse(`${ymd}T12:00:00`);
  if (!Number.isFinite(t)) return ymd;
  return new Date(t).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  });
}

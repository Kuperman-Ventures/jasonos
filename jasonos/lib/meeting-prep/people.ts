import { suggestedFamily, type CallSheetLine, type NetworkingStatus } from "./call-sheet";
import { FAMILY_LABELS, type PlaybookFamily } from "./playbook-blocks";

const ET = "America/New_York";
const HOUR = 3_600_000;

/** Browning: contact a referral within 48 hours. */
export const FIRST_CONTACT_HOURS = 48;
/** Thank-you within 24 hours of the call ending. */
export const THANK_YOU_HOURS = 24;
/** The Person header shows next contact in yellow inside this window. */
export const NEXT_CONTACT_SOON_DAYS = 14;

export const STATUS_LABELS: Record<NetworkingStatus, string> = {
  referral: "Referral",
  first_contacted: "First contacted",
  call_1: "Call 1 held",
  call_2: "Call 2 held",
  call_3: "Call 3 held",
  ongoing: "Ongoing",
  closed: "Closed",
};

export function statusLabel(status: NetworkingStatus | null): string {
  return status ? STATUS_LABELS[status] : "No status";
}

function at(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

export function etYmdOf(value: string | number | Date): string {
  return new Date(value).toLocaleDateString("en-CA", { timeZone: ET });
}

function dayNumber(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function daysUntil(fromYmd: string, toYmd: string): number {
  return dayNumber(toYmd) - dayNumber(fromYmd);
}

/** A referral nobody has contacted 48 hours after it came in. */
export function isPast48h(
  person: {
    status: NetworkingStatus | null;
    referralReceivedAt: string | null;
    firstContactAt: string | null;
  },
  now: number = Date.now()
): boolean {
  if (person.status !== "referral" || person.firstContactAt) return false;
  const received = at(person.referralReceivedAt);
  return received !== null && now - received > FIRST_CONTACT_HOURS * HOUR;
}

/** Next contact date is before today (Eastern). */
export function isOverdueNext(nextContact: string | null, todayYmd: string): boolean {
  return Boolean(nextContact) && (nextContact as string) < todayYmd;
}

export type NextContactTone = "magenta" | "yellow" | null;

/** Magenta only for a referral past 48 hours. Yellow when due within 14 days or overdue. */
export function nextContactTone(input: {
  past48h: boolean;
  nextContact: string | null;
  todayYmd: string;
}): NextContactTone {
  if (input.past48h) return "magenta";
  if (!input.nextContact) return null;
  return daysUntil(input.todayYmd, input.nextContact) <= NEXT_CONTACT_SOON_DAYS ? "yellow" : null;
}

/** "Call 2 of 3" on the People index; past three, "Call 4". */
export function callOfThree(touchCount: number): string {
  if (touchCount <= 0) return "No calls yet";
  return touchCount <= 3 ? `Call ${touchCount} of 3` : `Call ${touchCount}`;
}

/** "Call 1 of 3 held" on the Person header. */
export function heldOfThree(touchCount: number): string {
  if (touchCount <= 0) return "No calls held";
  return touchCount <= 3 ? `Call ${touchCount} of 3 held` : `${touchCount} calls held`;
}

export interface SortablePerson {
  name: string;
  overdue48h: boolean;
  overdueNext: boolean;
  nextContact: string | null;
}

/** Past-48h referrals, then overdue next contacts, then next contact date. No date sorts last. */
export function comparePeople(a: SortablePerson, b: SortablePerson): number {
  if (a.overdue48h !== b.overdue48h) return a.overdue48h ? -1 : 1;
  if (a.overdueNext !== b.overdueNext) return a.overdueNext ? -1 : 1;
  if (a.nextContact !== b.nextContact) {
    if (!a.nextContact) return 1;
    if (!b.nextContact) return -1;
    return a.nextContact < b.nextContact ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

/** Playbook for the next call: First Call until a call is held, Second Call after. */
export function nextPlaybookFamily(status: NetworkingStatus | null, touchCount: number): PlaybookFamily {
  return suggestedFamily(status, touchCount);
}

export function nextPlaybookLabel(status: NetworkingStatus | null, touchCount: number): string {
  return FAMILY_LABELS[nextPlaybookFamily(status, touchCount)];
}

export const CARRY_HINT = "To discuss next, from your last debrief";

/** Put to-discuss-next on the third Why line when that line is empty. Null when nothing changes. */
export function carryDiscussNext(lines: CallSheetLine[], toDiscussNext: string | null): CallSheetLine[] | null {
  const text = toDiscussNext?.trim();
  if (!text || lines.length < 3 || lines[2].text.trim()) return null;
  return lines.map((line, index) => (index === 2 ? { ...line, text, sourceHint: CARRY_HINT } : line));
}

const MEETING_CHANNELS = new Set(["phone", "call", "video", "in_person", "coffee_chat", "calendar"]);
const REACH_OUT_CHANNELS = new Set(["email", "linkedin", "text"]);

/**
 * A touch that counts as first contact with a referral: Jason reaching out by email,
 * LinkedIn or text, or any call or meeting, at or after the referral came in.
 */
export function countsAsFirstContact(touch: {
  channel: string | null;
  direction: string | null;
  touchedAt: string;
  referralReceivedAt: string | null;
}): boolean {
  const channel = touch.channel ?? "";
  const reachOut = REACH_OUT_CHANNELS.has(channel) && touch.direction !== "inbound";
  if (!reachOut && !MEETING_CHANNELS.has(channel)) return false;
  const touched = at(touch.touchedAt);
  if (touched === null) return false;
  const received = at(touch.referralReceivedAt);
  return received === null || touched >= received;
}

export function withinHours(fromIso: string | null, toIso: string | null, hours: number): boolean {
  const from = at(fromIso);
  const to = at(toIso);
  return from !== null && to !== null && to >= from && to - from <= hours * HOUR;
}

export type ThankYouState =
  | { kind: "sent"; at: string }
  | { kind: "due"; at: string }
  | { kind: "late"; at: string }
  | { kind: "none" };

export function thankYouState(input: { sentAt: string | null; dueAt: string | null }, now: number = Date.now()): ThankYouState {
  if (input.sentAt) return { kind: "sent", at: input.sentAt };
  const due = at(input.dueAt);
  if (due === null) return { kind: "none" };
  return { kind: now > due ? "late" : "due", at: input.dueAt as string };
}

/* ---------- Weekly activity ---------- */

export interface WeeklyActivityCounts {
  referralsReceived: number;
  firstContactsIn48h: { met: number; of: number };
  callsHeld: number;
  contactsReceived: number;
  thankYouIn24h: { met: number; of: number };
  secondCallsScheduled: number;
}

export function weeklyActivityCounts(input: {
  referrals: Array<{ receivedAt: string; firstContactAt: string | null }>;
  calls: Array<{ endsAt: string; thankYouSentAt: string | null; contactsReceived: number }>;
  secondCallsScheduled: number;
}): WeeklyActivityCounts {
  return {
    referralsReceived: input.referrals.length,
    firstContactsIn48h: {
      met: input.referrals.filter((row) => withinHours(row.receivedAt, row.firstContactAt, FIRST_CONTACT_HOURS)).length,
      of: input.referrals.length,
    },
    callsHeld: input.calls.length,
    contactsReceived: input.calls.reduce((sum, row) => sum + row.contactsReceived, 0),
    thankYouIn24h: {
      met: input.calls.filter((row) => withinHours(row.endsAt, row.thankYouSentAt, THANK_YOU_HOURS)).length,
      of: input.calls.length,
    },
    secondCallsScheduled: input.secondCallsScheduled,
  };
}

/**
 * Second calls booked: meetings first seen in the window with someone who has exactly
 * one held call before the meeting starts. Each person counts once.
 */
export function countSecondCalls(
  meetings: Array<{ id: string; startsAt: string; contactId: string }>,
  logs: Array<{ contactId: string; prepId: string | null; occurredAt: string }>
): number {
  const counted = new Set<string>();
  for (const meeting of meetings) {
    if (counted.has(meeting.contactId)) continue;
    const start = Date.parse(meeting.startsAt);
    const before = logs.filter(
      (log) => log.contactId === meeting.contactId && log.prepId !== meeting.id && Date.parse(log.occurredAt) < start
    );
    if (before.length === 1) counted.add(meeting.contactId);
  }
  return counted.size;
}

/** Browning tracking-sheet columns, one row per held call. */
export const ACTIVITY_LOG_COLUMNS = [
  "Date",
  "Name",
  "Company",
  "Call",
  "Conversation",
  "Contacts received",
  "Follow up with",
  "Next contact",
  "Thank-you sent",
] as const;

export interface ActivityLogRow {
  date: string;
  name: string;
  company: string | null;
  touchNumber: number;
  conversation: string | null;
  contactsReceived: Array<{ name: string; company: string | null }>;
  followUpWith: Array<{ text: string; owner: "me" | "them" }>;
  nextContact: string | null;
  thankYouSentAt: string | null;
}

export function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function activityLogCsv(rows: ActivityLogRow[]): string {
  const lines = [ACTIVITY_LOG_COLUMNS.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.date,
        row.name,
        row.company,
        row.touchNumber,
        row.conversation,
        row.contactsReceived.map((item) => (item.company ? `${item.name} (${item.company})` : item.name)).join("; "),
        row.followUpWith.map((item) => `${item.owner === "me" ? "Me" : "Them"}: ${item.text}`).join("; "),
        row.nextContact,
        row.thankYouSentAt ? etYmdOf(row.thankYouSentAt) : "No",
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function activityLogFilename(weekStart: string): string {
  return `Activity Log ${weekStart}.csv`;
}

import type { CallSheetLine, NetworkingStatus } from "./call-sheet";

/** What Jason heard on the call and what happens next. Saved on the After block; logged on Confirm. */
export type ReceivedStatus = "suggested" | "accepted" | "dismissed";

export interface ReceivedContact {
  name: string;
  company: string | null;
  note: string | null;
  status: ReceivedStatus;
}

export type FollowUpOwner = "me" | "them";

export interface FollowUp {
  text: string;
  owner: FollowUpOwner;
}

export interface AfterDraft {
  conversation: string;
  contactsReceived: ReceivedContact[];
  followUpWith: FollowUp[];
  /** YYYY-MM-DD, Eastern. */
  nextContactAt: string | null;
  toDiscussNext: string;
}

export const EMPTY_AFTER: AfterDraft = {
  conversation: "",
  contactsReceived: [],
  followUpWith: [],
  nextContactAt: null,
  toDiscussNext: "",
};

export const AFTER_LABELS = {
  conversation: "Conversation",
  contacts: "Contacts received",
  followUps: "Follow up with",
  nextContact: "Next contact",
  toDiscuss: "To discuss next",
} as const;

const ET = "America/New_York";
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 2000;
const MAX_ROWS = 20;

function clean(value: unknown, max = MAX_TEXT): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/\r\n/g, "\n").trim();
  return text.length <= max ? text : text.slice(0, max).trim();
}

function oneLine(value: unknown, max = 300): string {
  return clean(value, max).replace(/\s*\|\s*/g, " / ").replace(/\s+/g, " ");
}

function asStatus(value: string): ReceivedStatus {
  return value === "accepted" || value === "dismissed" ? value : "suggested";
}

export function asYmd(value: unknown): string | null {
  return typeof value === "string" && YMD.test(value.trim()) ? value.trim() : null;
}

/**
 * The After block stores the draft as five labeled lines. Contacts and follow-ups
 * are one row per line inside their line: "accepted | Name | Company | note", "me | text".
 */
export function afterDraftToLines(draft: AfterDraft): CallSheetLine[] {
  const contacts = draft.contactsReceived
    .filter((row) => row.name.trim())
    .slice(0, MAX_ROWS)
    .map((row) => [row.status, oneLine(row.name, 120), oneLine(row.company ?? "", 120), oneLine(row.note ?? "")].join(" | "))
    .join("\n");
  const followUps = draft.followUpWith
    .filter((row) => row.text.trim())
    .slice(0, MAX_ROWS)
    .map((row) => `${row.owner} | ${oneLine(row.text)}`)
    .join("\n");
  return [
    { label: AFTER_LABELS.conversation, text: clean(draft.conversation), sourceHint: null },
    { label: AFTER_LABELS.contacts, text: contacts, sourceHint: null },
    { label: AFTER_LABELS.followUps, text: followUps, sourceHint: null },
    { label: AFTER_LABELS.nextContact, text: asYmd(draft.nextContactAt) ?? "", sourceHint: null },
    { label: AFTER_LABELS.toDiscuss, text: clean(draft.toDiscussNext), sourceHint: null },
  ];
}

function parseContacts(text: string): ReceivedContact[] {
  const rows: ReceivedContact[] = [];
  for (const raw of text.split("\n")) {
    const parts = raw.split("|").map((part) => part.trim());
    if (parts.length < 2 || !parts[1]) continue;
    rows.push({
      status: asStatus(parts[0]),
      name: parts[1],
      company: parts[2] || null,
      note: parts.slice(3).join(" / ") || null,
    });
  }
  return rows;
}

function parseFollowUps(text: string): FollowUp[] {
  const rows: FollowUp[] = [];
  for (const raw of text.split("\n")) {
    const match = raw.match(/^\s*(me|them)\s*\|\s*(.+)$/i);
    const body = (match ? match[2] : raw).trim();
    if (!body) continue;
    rows.push({ owner: match?.[1].toLowerCase() === "them" ? "them" : "me", text: body });
  }
  return rows;
}

/** Null when the After block has never been saved from Debrief. */
export function afterDraftFromLines(lines: CallSheetLine[]): AfterDraft | null {
  const byLabel = new Map(lines.map((line) => [line.label, line.text]));
  const known = Object.values(AFTER_LABELS).some((label) => byLabel.has(label));
  if (!known) return null;
  return {
    conversation: byLabel.get(AFTER_LABELS.conversation) ?? "",
    contactsReceived: parseContacts(byLabel.get(AFTER_LABELS.contacts) ?? ""),
    followUpWith: parseFollowUps(byLabel.get(AFTER_LABELS.followUps) ?? ""),
    nextContactAt: asYmd(byLabel.get(AFTER_LABELS.nextContact)),
    toDiscussNext: byLabel.get(AFTER_LABELS.toDiscuss) ?? "",
  };
}

/** The After fields a logged call already holds, for calls logged before Debrief saved a draft. */
export function afterDraftFromLog(log: {
  conversation: string | null;
  contactsReceived: Array<{ name: string; company: string | null; note: string | null }>;
  followUpWith: FollowUp[];
  nextContactAt: string | null;
  toDiscussNext: string | null;
}): AfterDraft {
  return {
    conversation: log.conversation ?? "",
    contactsReceived: log.contactsReceived.map((row) => ({
      name: row.name,
      company: row.company,
      note: row.note,
      status: "accepted",
    })),
    followUpWith: log.followUpWith,
    nextContactAt: log.nextContactAt,
    toDiscussNext: log.toDiscussNext ?? "",
  };
}

export function sameAfterDraft(a: AfterDraft, b: AfterDraft): boolean {
  const lines = (draft: AfterDraft) => afterDraftToLines(draft).map((line) => line.text);
  return JSON.stringify(lines(a)) === JSON.stringify(lines(b));
}

export function acceptedContacts(draft: AfterDraft): ReceivedContact[] {
  return draft.contactsReceived.filter((row) => row.status === "accepted" && row.name.trim());
}

function easternYmd(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: ET });
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Two weeks after a first call, three weeks after later ones (the Browning closes). */
export function defaultNextContact(occurredAt: string, touchNumber: number): string | null {
  const at = Date.parse(occurredAt);
  if (Number.isNaN(at)) return null;
  return addDaysYmd(easternYmd(at), touchNumber <= 1 ? 14 : 21);
}

/** Browning status after this many held calls. Closed stays closed. */
export function statusAfterTouch(current: NetworkingStatus | null, touchCount: number): NetworkingStatus | null {
  if (current === "closed") return current;
  if (touchCount <= 0) return current;
  if (touchCount === 1) return "call_1";
  if (touchCount === 2) return "call_2";
  if (touchCount === 3) return "call_3";
  return "ongoing";
}

/** Thank-you due 24 hours after the call ends. */
export function thankYouDueBy(endsAt: string): string | null {
  const at = Date.parse(endsAt);
  return Number.isNaN(at) ? null : new Date(at + 24 * 3_600_000).toISOString();
}

/* ---------- Planned against said ---------- */

export type SaidStatus = "covered" | "partial" | "skipped";

export interface PlannedPoint {
  id: string;
  kind: string;
  headline: string;
  state: string;
  note: string | null;
  confirmedState: string | null;
}

export interface SpokenRow {
  pointId: string;
  match: string;
  nearest: string | null;
  timestamp: string | null;
}

export interface PlannedRow {
  id: string;
  headline: string;
  happened: string;
  status: SaidStatus;
}

function liveWord(state: string): string {
  if (state === "covered") return "Marked covered live";
  if (state === "skipped") return "Skipped live";
  return "Not reached live";
}

export function plannedAgainstSaid(points: PlannedPoint[], spoken: SpokenRow[] | null): PlannedRow[] {
  const byId = new Map((spoken ?? []).map((row) => [row.pointId, row]));
  return points
    .filter((point) => point.kind !== "agenda")
    .map((point) => {
      const found = byId.get(point.id);
      let status: SaidStatus;
      if (point.confirmedState === "covered") status = "covered";
      else if (point.confirmedState === "skipped" || point.confirmedState === "not_reached") status = "skipped";
      else if (found?.match === "exact") status = "covered";
      else if (found?.match === "close") status = "partial";
      else if (found) status = point.state === "covered" ? "partial" : "skipped";
      else status = point.state === "covered" ? "covered" : "skipped";
      const heard = found?.nearest?.trim()
        ? `${found.timestamp ? `${found.timestamp} · ` : ""}${found.nearest.trim()}`
        : null;
      const happened = [point.note?.trim() || null, heard].filter(Boolean).join(" · ") || liveWord(point.state);
      return { id: point.id, headline: point.headline, happened, status };
    });
}

/* ---------- Pre-fill from the review ---------- */

export function prefillAfter(input: {
  points: PlannedPoint[];
  review: { relationshipGoalNote: string | null; projectGoalNote: string | null; suggestedReason: string | null } | null;
  occurredAt: string;
  touchNumber: number;
}): AfterDraft {
  const markable = input.points.filter((point) => point.kind !== "agenda");
  const noted = markable
    .filter((point) => point.note?.trim())
    .map((point) => `${point.headline.replace(/[?.]+$/, "")}: ${point.note!.trim()}`);
  const reviewLines = [
    input.review?.relationshipGoalNote,
    input.review?.projectGoalNote,
    noted.length ? null : input.review?.suggestedReason,
  ]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));
  const open = markable
    .filter((point) => point.state !== "covered" && point.kind !== "ask")
    .map((point) => point.headline.trim())
    .slice(0, 3);
  return {
    conversation: [...noted, ...reviewLines].join("\n"),
    contactsReceived: [],
    followUpWith: [],
    nextContactAt: defaultNextContact(input.occurredAt, input.touchNumber),
    toDiscussNext: open.length ? `Pick up: ${open.join("; ")}` : "",
  };
}

export interface AfterExtract {
  conversation: string | null;
  contactsReceived: Array<{ name: string; company: string | null; note: string | null }>;
  followUpWith: FollowUp[];
  toDiscussNext: string | null;
}

export function afterExtractSystemPrompt(writingRules: string): string {
  return `Jason just finished a call. From the transcript or notes, fill his after-call log. Return JSON only:
{"conversation":"...","contactsReceived":[{"name":"...","company":"...","note":"..."}],"followUps":[{"text":"...","owner":"me"}],"toDiscussNext":"..."}
Rules:
- "conversation" is two to four plain sentences: what they told Jason that matters later (facts, needs, plans, names). Not a recap of Jason's pitch.
- "contactsReceived" lists only people the other person named for Jason to contact or offered to introduce. Name, company when said, and one short note on why. Empty when nobody was named.
- "followUps" are concrete actions someone promised. owner "me" for Jason's, "them" for theirs. Start each with a verb. Empty when none.
- "toDiscussNext" is one or two sentences: what to bring up on the next call.
- Use only what the source says. Never invent names, companies, numbers or promises.
${writingRules}`;
}

export function buildAfterExtractMessage(input: {
  personName: string | null;
  outcomeSentence: string | null;
  points: Array<{ headline: string; state: string; note: string | null }>;
  source: string;
}): string {
  return JSON.stringify({
    person: input.personName,
    outcome: input.outcomeSentence,
    points: input.points.map((point) => ({ headline: point.headline, state: point.state, note: point.note })),
    source: input.source,
  });
}

function unwrapJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

export function parseAfterExtract(text: string): AfterExtract | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(unwrapJson(text));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const row = parsed as Record<string, unknown>;
  const list = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      : [];
  return {
    conversation: clean(row.conversation) || null,
    contactsReceived: list(row.contactsReceived)
      .map((item) => ({
        name: oneLine(item.name, 120),
        company: oneLine(item.company, 120) || null,
        note: oneLine(item.note) || null,
      }))
      .filter((item) => item.name)
      .slice(0, MAX_ROWS),
    followUpWith: list(row.followUps ?? row.followUpWith)
      .map((item): FollowUp => ({
        text: oneLine(item.text),
        owner: item.owner === "them" ? "them" : "me",
      }))
      .filter((item) => item.text)
      .slice(0, MAX_ROWS),
    toDiscussNext: clean(row.toDiscussNext) || null,
  };
}

/** Lay a transcript extract over the current draft. Rows Jason already decided on stay. */
export function mergeAfterExtract(base: AfterDraft, extract: AfterExtract): AfterDraft {
  const names = new Set(base.contactsReceived.map((row) => row.name.trim().toLowerCase()));
  const texts = new Set(base.followUpWith.map((row) => row.text.trim().toLowerCase()));
  return {
    conversation: extract.conversation ?? base.conversation,
    contactsReceived: [
      ...base.contactsReceived,
      ...extract.contactsReceived
        .filter((row) => !names.has(row.name.toLowerCase()))
        .map((row): ReceivedContact => ({ ...row, status: "suggested" })),
    ],
    followUpWith: [
      ...base.followUpWith,
      ...extract.followUpWith.filter((row) => !texts.has(row.text.toLowerCase())),
    ],
    nextContactAt: base.nextContactAt,
    toDiscussNext: extract.toDiscussNext ?? base.toDiscussNext,
  };
}

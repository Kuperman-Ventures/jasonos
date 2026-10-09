// Plain shapes for what JasonOS already knows about a meeting.
// No database and no AI. Safe for the prep page and tests.

export interface MeetingHomeContext {
  touchCount: number;
  emailThreadCount: number;
  lastContactAt: string | null;
  lastContactChannel: string | null;
  hasBrowningIntro: boolean;
  hasLinkedIn: boolean;
}

export const EMPTY_HOME_CONTEXT: MeetingHomeContext = {
  touchCount: 0,
  emailThreadCount: 0,
  lastContactAt: null,
  lastContactChannel: null,
  hasBrowningIntro: false,
  hasLinkedIn: false,
};

export interface HistoryTouch {
  id: string;
  contactId: string;
  channel: string;
  source: string | null;
  direction: string | null;
  touchedAt: string;
  subject: string | null;
  brief: string | null;
  threadUrl: string | null;
}

export interface HistoryEntry {
  id: string;
  channelLabel: string;
  direction: string | null;
  title: string;
  preview: string | null;
  url: string | null;
  messageCount: number;
  firstAt: string;
  lastAt: string;
}

export function gmailThreadUrl(account: string, threadId: string): string {
  // /mail/u/<email>/ with @ encoded as %40 opens a dead Gmail page.
  // authuser selects the mailbox and #all opens the conversation.
  let mailbox = account;
  try {
    mailbox = decodeURIComponent(account);
  } catch {
    mailbox = account;
  }
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(mailbox)}#all/${threadId}`;
}

/** Stored touch links sometimes encode @ in the mailbox. Gmail will not open those. */
export function repairGmailUrl(url: string | null | undefined): string | null {
  const value = url?.trim();
  if (!value || !/mail\.google\.com\/mail\//i.test(value)) return value || null;
  const thread = value.match(/#(?:all|inbox|sent)\/([A-Za-z0-9_-]+)/);
  if (!thread) return value;
  const account = value.match(/\/mail\/u\/([^/#]+)\//i);
  const authuser = value.match(/[?&]authuser=([^&#]+)/i);
  const raw = account?.[1] || authuser?.[1];
  if (!raw) return value;
  return gmailThreadUrl(raw, thread[1]);
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/gi;

export function linkify(text: string): Array<{ text: string; href: string | null }> {
  const parts: Array<{ text: string; href: string | null }> = [];
  let last = 0;
  for (const match of text.matchAll(URL_IN_TEXT)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const href = raw.replace(/[),.;]+$/, "");
    const trailing = raw.slice(href.length);
    if (start > last) parts.push({ text: text.slice(last, start), href: null });
    parts.push({ text: href, href });
    if (trailing) parts.push({ text: trailing, href: null });
    last = start + raw.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), href: null });
  if (!parts.length) parts.push({ text, href: null });
  return parts;
}

export function collapseText(value: string | null | undefined): string | null {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

export function touchChannelLabel(touch: {
  channel: string;
  source: string | null;
  brief: string | null;
  subject: string | null;
}): string {
  const source = (touch.source ?? "").toLowerCase();
  const channel = touch.channel.toLowerCase();
  const blob = `${touch.brief ?? ""} ${touch.subject ?? ""}`.toLowerCase();
  if (source === "gmail") return "Gmail";
  if (source === "outlook") return "Outlook";
  if (channel === "linkedin" || source === "linkedin" || blob.includes("linkedin")) {
    return "LinkedIn";
  }
  if (channel === "text" || source === "beeper") return "Text";
  if (channel === "calendar" || source === "gcal") return "Calendar";
  if (channel === "phone" || channel === "call") return "Call";
  if (channel === "email") return "Email";
  if (!channel) return "Note";
  return channel.charAt(0).toUpperCase() + channel.slice(1);
}

export function directionLabel(direction: string | null | undefined): string | null {
  if (direction === "inbound") return "Inbound";
  if (direction === "outbound") return "Outbound";
  return null;
}

function previewText(value: string | null): string | null {
  const text = collapseText(value);
  if (!text) return null;
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

function entryFromTouches(touches: HistoryTouch[]): HistoryEntry {
  const ordered = [...touches].sort(
    (a, b) => Date.parse(b.touchedAt) - Date.parse(a.touchedAt)
  );
  const newest = ordered[0];
  const oldest = ordered[ordered.length - 1];
  const title =
    collapseText(newest.subject) ||
    previewText(newest.brief) ||
    touchChannelLabel(newest);
  return {
    id: newest.id,
    channelLabel: touchChannelLabel(newest),
    direction: directionLabel(newest.direction),
    title,
    preview: previewText(newest.brief),
    url: repairGmailUrl(newest.threadUrl),
    messageCount: ordered.length,
    firstAt: oldest.touchedAt,
    lastAt: newest.touchedAt,
  };
}

/** Email rows that share a thread link become one entry. Everything else stays one row. */
export function groupCommunicationHistory(touches: HistoryTouch[]): HistoryEntry[] {
  const emails = new Map<string, HistoryTouch[]>();
  const singles: HistoryEntry[] = [];

  for (const touch of touches) {
    const thread = touch.threadUrl?.trim();
    if (touch.channel === "email" && thread) {
      const group = emails.get(thread) ?? [];
      group.push(touch);
      emails.set(thread, group);
      continue;
    }
    singles.push(entryFromTouches([touch]));
  }

  const entries = [
    ...singles,
    ...[...emails.values()].map((group) => entryFromTouches(group)),
  ];
  entries.sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt));
  return entries;
}

export function isLinkedInTouch(touch: {
  channel: string;
  source: string | null;
  brief: string | null;
  subject: string | null;
}): boolean {
  return touchChannelLabel(touch) === "LinkedIn";
}

export function emailThreadKey(touch: {
  id: string;
  channel: string;
  threadUrl: string | null;
}): string | null {
  if (touch.channel !== "email") return null;
  return touch.threadUrl?.trim() || `message:${touch.id}`;
}

export function attachmentLabel(filename: string | null | undefined): string {
  return collapseText(filename) || "Attachment on the introduction email";
}

/** Counts Home prints under a meeting title. */
export function summarizeHome(
  touches: HistoryTouch[],
  hasBrowningIntro: boolean
): MeetingHomeContext {
  const threads = new Set<string>();
  let last: HistoryTouch | null = null;
  let hasLinkedIn = false;
  for (const touch of touches) {
    const key = emailThreadKey(touch);
    if (key) threads.add(key);
    if (isLinkedInTouch(touch)) hasLinkedIn = true;
    if (!last || Date.parse(touch.touchedAt) > Date.parse(last.touchedAt)) last = touch;
  }
  return {
    touchCount: touches.length,
    emailThreadCount: threads.size,
    lastContactAt: last?.touchedAt ?? null,
    lastContactChannel: last ? touchChannelLabel(last) : null,
    hasBrowningIntro,
    hasLinkedIn,
  };
}

export function meetingContextLine(
  home: MeetingHomeContext,
  nowIso: string
): string {
  if (home.touchCount === 0 && !home.hasBrowningIntro) {
    return "No history in JasonOS.";
  }
  const parts: string[] = [];
  if (home.hasBrowningIntro) parts.push("Intro from Tracy (Browning)");
  if (home.emailThreadCount === 1) parts.push("1 email thread");
  else if (home.emailThreadCount > 1) {
    parts.push(`${home.emailThreadCount} email threads`);
  }
  if (home.hasLinkedIn) parts.push("LinkedIn message");
  if (home.lastContactAt) {
    parts.push(`last contact ${shortEasternDate(home.lastContactAt, nowIso)}`);
  }
  return parts.join(" · ") || "No history in JasonOS.";
}

export function shortEasternDate(iso: string, nowIso: string): string {
  const date = new Date(iso);
  const now = new Date(nowIso);
  const year = date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
  });
  const thisYear = now.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
  });
  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    ...(year === thisYear ? {} : { year: "numeric" as const }),
  });
}

export function easternDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export interface MeetingContextPerson {
  contactId: string;
  email: string;
  name: string;
  title: string | null;
  company: string | null;
  linkedinUrl: string | null;
  relationshipType: string | null;
  intent: string | null;
  networkRole: string | null;
  notes: string | null;
  personalGoal: string | null;
  phone: string | null;
  referredByName: string | null;
  researchLead: string | null;
  researchBullets: string[];
  researchEmpty: boolean;
  browningPrep: string | null;
}

export interface MeetingContextConnection {
  id: string;
  subject: string | null;
  receivedAt: string | null;
  whyTheyReplied: string | null;
  ask: string | null;
  who: string | null;
  why: string | null;
  overlap: string | null;
  emailUrl: string | null;
  attachmentLabel: string;
}

export interface MeetingContextDocument {
  id: string;
  label: string;
  url: string | null;
}

export interface MeetingContextPast {
  id: string;
  when: string | null;
  title: string | null;
  debriefNotes: string | null;
  nextStep: string | null;
  prepNotes: string | null;
  introAsks: string[];
  granolaSummary: string | null;
  granolaUrl: string | null;
}

export interface MeetingContextJob {
  id: string;
  kind: "interview" | "job";
  title: string;
  company: string | null;
  href: string;
}

export interface MeetingContextUnmatched {
  email: string;
  name: string | null;
}

export interface MeetingContext {
  people: MeetingContextPerson[];
  unmatched: MeetingContextUnmatched[];
  connections: MeetingContextConnection[];
  history: HistoryEntry[];
  documents: MeetingContextDocument[];
  pastMeetings: MeetingContextPast[];
  jobSearch: MeetingContextJob[];
  home: MeetingHomeContext;
}

export interface HomeContextMeeting {
  id: string;
  gcalEventId: string;
  attendees: Array<{ email: string; contactId: string | null }>;
}

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
  return collapseText(filename) || "Attached resume (Word or PDF)";
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
  researchSources: Array<{ title: string | null; url: string }>;
  researchAt: string | null;
  researchEmpty: boolean;
  companyResearch: {
    name: string | null;
    lead: string | null;
    bullets: string[];
    sources: Array<{ title: string | null; url: string }>;
  } | null;
  tracks: string[];
  browningPrep: string | null;
  /** Open / overdue / awaiting commitments from the relationship brief. */
  openCommitments: Array<{
    text: string;
    direction: "mine" | "theirs";
    status: string;
    due: string | null;
  }>;
  remember: string[];
  helped: string[];
  topics: string[];
  nextMove: string | null;
  relationshipSummary: string | null;
  /** Email/text/call rows. Calendar holds are not counted. */
  directTouchCount: number;
  lastTouchAt: string | null;
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
  questions: string[];
  meetingBrief: string | null;
  emailUrl: string | null;
  /** Word/PDF Tracy attached — label even when filename not stored yet. */
  attachmentLabel: string | null;
  attachmentUrl: string | null;
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
  prepGoal: string | null;
  prepShortAsk: string | null;
  prepResearch: string | null;
  introAsks: string[];
  granolaSummary: string | null;
  granolaUrl: string | null;
}

export interface MeetingContextGranolaNote {
  id: string;
  title: string | null;
  summary: string;
  url: string | null;
  when: string | null;
  kind: "this_meeting" | "recent";
}

export interface MeetingContextBrief {
  /** One or two paragraphs assembled from JasonOS sources. */
  summary: string | null;
  nextMove: string | null;
  commitments: Array<{
    text: string;
    direction: "mine" | "theirs";
    status: string;
    due: string | null;
    personName: string;
  }>;
  remember: string[];
  helped: string[];
  topics: string[];
  /** Where the brief bits came from. */
  provenance: string[];
}

export interface MeetingContextRecentEmail {
  subject: string | null;
  summary: string;
  threadUrl: string | null;
  personName: string;
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
  brief: MeetingContextBrief;
  briefing: MeetingBriefing;
  granolaNotes: MeetingContextGranolaNote[];
  recentEmail: MeetingContextRecentEmail | null;
}

/** Build the Brief strip from people + Browning connection already loaded. */
export function composeMeetingBrief(input: {
  people: MeetingContextPerson[];
  connections: MeetingContextConnection[];
}): MeetingContextBrief {
  const provenance: string[] = [];
  const commitments: MeetingContextBrief["commitments"] = [];
  const remember: string[] = [];
  const helped: string[] = [];
  const topics: string[] = [];
  const summaryParts: string[] = [];
  let nextMove: string | null = null;

  for (const person of input.people) {
    if (person.relationshipSummary) {
      summaryParts.push(person.relationshipSummary);
      provenance.push(`Relationship brief · ${person.name}`);
    }
    if (!nextMove && person.nextMove) nextMove = person.nextMove;
    for (const item of person.openCommitments) {
      commitments.push({ ...item, personName: person.name });
    }
    for (const line of person.remember) {
      if (!remember.includes(line)) remember.push(line);
    }
    for (const line of person.helped) {
      if (!helped.includes(line)) helped.push(line);
    }
    for (const line of person.topics) {
      if (!topics.includes(line)) topics.push(line);
    }
  }

  const connection = input.connections[0];
  if (connection?.ask && !summaryParts.length) {
    summaryParts.push(connection.ask);
    provenance.push("Browning introduction");
  } else if (connection?.ask) {
    provenance.push("Browning introduction");
  }
  if (connection?.meetingBrief) {
    summaryParts.push(connection.meetingBrief);
    if (!provenance.includes("Browning call brief")) {
      provenance.push("Browning call brief");
    }
  }

  if (commitments.length) provenance.push("Open commitments");
  if (remember.length) provenance.push("Remember");

  return {
    summary: summaryParts.length ? summaryParts.join("\n\n") : null,
    nextMove,
    commitments,
    remember: remember.slice(0, 6),
    helped: helped.slice(0, 4),
    topics: topics.slice(0, 6),
    provenance: [...new Set(provenance)],
  };
}

export interface HomeContextMeeting {
  id: string;
  gcalEventId: string;
  attendees: Array<{ email: string; contactId: string | null }>;
}

export interface BriefingPersonRef {
  contactId: string;
  name: string;
  email: string;
}

export interface BriefingBeat {
  id: string;
  at: string;
  contactId: string;
  name: string;
  direction: "inbound" | "outbound" | null;
  /** Readable sentence. Links and signatures stripped. */
  text: string;
  url: string | null;
  subject: string | null;
}

export interface BriefingThread {
  id: string;
  title: string;
  url: string | null;
  firstAt: string;
  lastAt: string;
  messageCount: number;
  schedulingCount: number;
}

export interface OtherThread {
  id: string;
  title: string;
  channelLabel: string;
  url: string | null;
  lastAt: string;
  messageCount: number;
  preview: string | null;
  names: string[];
}

/** What to read before the call, assembled from touches already in JasonOS. */
export interface MeetingBriefing {
  whereItStands: BriefingBeat | null;
  yourStake: BriefingBeat | null;
  introduction: BriefingBeat | null;
  meetingThread: BriefingThread | null;
  otherThreads: OtherThread[];
}

const COMPANY_STOP = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "the",
  "meet",
  "email",
  "sent",
  "outlook",
  "gmail",
  "linkedin",
  "phone",
  "thanks",
  "regards",
  "inc",
  "llc",
]);

/** "Re: Re: Foo" and "Foo" are the same conversation subject. */
export function subjectKey(subject: string | null | undefined): string {
  return (subject ?? "")
    .replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => {
      const n = Number(code);
      return n > 0 && n < 65536 ? String.fromCharCode(n) : "";
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

/** Decode, drop quoted replies and mobile signatures, keep URLs. */
export function normalizeTouchText(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  let text = decodeEntities(raw);
  text = text.replace(/<((?:https?:\/\/)[^>\s]+)>/gi, " $1 ");
  // Stored notes are clipped at 200 characters, sometimes mid-link: "<https://…"
  text = text.replace(/<https?:\/\/\S*/gi, " ");
  text = text.split(/\bOn\s+.{0,80}\bwrote:/i)[0] ?? text;
  text = text.split(/_{5,}/)[0] ?? text;
  text = text.split(/\bFrom:\s+\S+@/i)[0] ?? text;
  text = text.replace(/\bSent from (?:my |the )?.*/i, "");
  const signoff = text.match(/^(.*\S)\s+looking forward\b[\s\S]*$/i);
  if (signoff && signoff[1].length >= 40) text = signoff[1];
  text = text.replace(/\s+/g, " ").trim();
  return text || null;
}

/** Sentence you can read. URLs removed. Trailing cut marked when the stored note was clipped. */
export function displayTouchText(value: string | null | undefined): string | null {
  const normalized = normalizeTouchText(value);
  if (!normalized) return null;
  let text = normalized.replace(/https?:\/\/\S+/gi, " ");
  text = text
    .replace(/\s+,/g, ",")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+([,.;])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,.\s]+/, "")
    .replace(/[,:\s]+$/, "")
    .trim();
  if (!text) return null;
  const raw = (value ?? "").trim();
  const clipped = raw.length >= 199 && !/looking forward\b/i.test(raw);
  if (clipped && !/[.!?…]$/.test(text)) text = `${text}…`;
  return text;
}

function beatDirection(value: string | null): "inbound" | "outbound" | null {
  if (value === "inbound" || value === "outbound") return value;
  return null;
}

function isCalendarStub(touch: HistoryTouch, text: string | null): boolean {
  if (touch.channel === "calendar") return true;
  const subject = collapseText(touch.subject)?.toLowerCase();
  const brief = text?.toLowerCase();
  if (subject && brief && subject === brief) return true;
  return false;
}

const SUBSTANCE_RE =
  /\b(i would start|start with|i can help|from my review|strategy|opportunity|\d\))/i;
const SCHEDULE_RE =
  /\b(works for me|that works|next week|this week|same time|send (?:out )?an invite|updated invite|reschedul|running late|\d+\s*min late|unwell|sorry|apolog|this afternoon|calendar invite|monday|tuesday|wednesday|thursday|friday)\b/i;

export function isSchedulingNote(text: string): boolean {
  if (SUBSTANCE_RE.test(text)) return false;
  return SCHEDULE_RE.test(text);
}

function isSubstance(text: string): boolean {
  if (SUBSTANCE_RE.test(text)) return true;
  if (SCHEDULE_RE.test(text)) return false;
  return text.length >= 140;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function mentionedPeople(
  text: string,
  people: BriefingPersonRef[]
): BriefingPersonRef[] {
  const hay = text.toLowerCase();
  return people.filter((person) => {
    const email = person.email.trim().toLowerCase();
    if (email && hay.includes(email)) return true;
    const last = person.name.trim().split(/\s+/).pop()?.toLowerCase() ?? "";
    return last.length >= 3 && hay.includes(last);
  });
}

function toBeat(
  touch: HistoryTouch,
  peopleById: Map<string, BriefingPersonRef>,
  text: string
): BriefingBeat {
  const person = peopleById.get(touch.contactId);
  return {
    id: touch.id,
    at: touch.touchedAt,
    contactId: touch.contactId,
    name: person?.name || "Someone",
    direction: beatDirection(touch.direction),
    text,
    url: repairGmailUrl(touch.threadUrl),
    subject: collapseText(touch.subject),
  };
}

/**
 * Pull the three things worth reading before a call out of stored touch notes.
 * Does not invent text. Scheduling back-and-forth stays a count, not a list.
 */
export function buildMeetingBriefing(input: {
  title: string;
  people: BriefingPersonRef[];
  touches: HistoryTouch[];
}): MeetingBriefing {
  const peopleById = new Map(input.people.map((person) => [person.contactId, person]));
  const prepared = input.touches.flatMap((touch) => {
    const display = displayTouchText(touch.brief);
    const normalized = normalizeTouchText(touch.brief);
    if (!display || !normalized || isCalendarStub(touch, display)) return [];
    return [{ touch, display, normalized }];
  });
  prepared.sort((a, b) => Date.parse(a.touch.touchedAt) - Date.parse(b.touch.touchedAt));

  const seen = new Set<string>();
  const unique = prepared.filter((row) => {
    const key = `${row.touch.touchedAt}|${row.display.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const meetingKey = subjectKey(input.title);
  const onMeeting =
    meetingKey.length >= 12
      ? unique.filter((row) => subjectKey(row.touch.subject) === meetingKey)
      : [];

  const latestOnMeeting = onMeeting[onMeeting.length - 1] ?? null;
  const whereItStands = latestOnMeeting
    ? toBeat(latestOnMeeting.touch, peopleById, latestOnMeeting.display)
    : null;

  const stakeRow = [...unique]
    .reverse()
    .find(
      (row) =>
        row.touch.direction === "outbound" &&
        isSubstance(row.display) &&
        row.touch.id !== whereItStands?.id
    );
  const yourStake = stakeRow
    ? toBeat(stakeRow.touch, peopleById, stakeRow.display)
    : null;

  const introRow = unique.find((row) => {
    if (row.touch.id === whereItStands?.id || row.touch.id === yourStake?.id) return false;
    const others = mentionedPeople(row.normalized, input.people).filter(
      (person) => person.contactId !== row.touch.contactId
    );
    if (!others.length) return false;
    return /\bmeet\b/i.test(row.normalized) || /\bintroduc/i.test(row.normalized) || others.length >= 2;
  });
  const introduction = introRow
    ? toBeat(introRow.touch, peopleById, introRow.display)
    : null;

  const meetingThread: BriefingThread | null = onMeeting.length
    ? {
        id: onMeeting[0].touch.threadUrl || onMeeting[0].touch.id,
        title: collapseText(onMeeting[onMeeting.length - 1].touch.subject) || input.title,
        url: repairGmailUrl(
          [...onMeeting].reverse().find((row) => row.touch.threadUrl)?.touch.threadUrl
        ),
        firstAt: onMeeting[0].touch.touchedAt,
        lastAt: onMeeting[onMeeting.length - 1].touch.touchedAt,
        messageCount: onMeeting.length,
        schedulingCount: onMeeting.filter((row) => isSchedulingNote(row.display)).length,
      }
    : null;

  const meetingIds = new Set(onMeeting.map((row) => row.touch.id));
  const featured = new Set(
    [whereItStands?.text, yourStake?.text, introduction?.text]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase())
  );
  const groups = new Map<string, typeof unique>();
  for (const row of unique) {
    if (meetingIds.has(row.touch.id)) continue;
    const thread = row.touch.channel === "email" ? row.touch.threadUrl?.trim() : "";
    const key = thread || `touch:${row.touch.id}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  const otherThreads: OtherThread[] = [...groups.values()]
    .map((group) => {
      const newest = group[group.length - 1];
      const names = [
        ...new Set(
          group
            .map((row) => peopleById.get(row.touch.contactId)?.name)
            .filter((name): name is string => Boolean(name))
        ),
      ];
      const preview = newest.display;
      return {
        id: newest.touch.id,
        title:
          collapseText(newest.touch.subject) ||
          preview ||
          touchChannelLabel(newest.touch),
        channelLabel: touchChannelLabel(newest.touch),
        url: repairGmailUrl(newest.touch.threadUrl),
        lastAt: newest.touch.touchedAt,
        messageCount: group.length,
        preview: featured.has(preview.toLowerCase()) ? null : preview,
        names,
      };
    })
    .sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt))
    .slice(0, 6);

  return { whereItStands, yourStake, introduction, meetingThread, otherThreads };
}

/**
 * Fill a missing company or LinkedIn when an email note already states them.
 * Does not overwrite a value stored on the contact.
 */
export function enrichPeopleFromTouches(
  people: MeetingContextPerson[],
  touches: HistoryTouch[]
): MeetingContextPerson[] {
  const blobs = touches
    .map((touch) => normalizeTouchText(touch.brief))
    .filter((value): value is string => Boolean(value));
  const refs: BriefingPersonRef[] = people.map((person) => ({
    contactId: person.contactId,
    name: person.name,
    email: person.email,
  }));
  const companyById = new Map<string, string>();
  const linkedinById = new Map<string, string>();

  for (const blob of blobs) {
    const companyMatch = blob.match(/\bof\s+([A-Z][A-Za-z0-9&]+(?:\s+[A-Z][A-Za-z0-9&]+){0,2})/);
    const company = companyMatch?.[1]?.trim();
    if (company && !COMPANY_STOP.has(company.toLowerCase())) {
      for (const person of mentionedPeople(blob, refs)) {
        if (!companyById.has(person.contactId)) companyById.set(person.contactId, company);
      }
    }
    for (const person of refs) {
      if (linkedinById.has(person.contactId)) continue;
      const match = blob.match(
        new RegExp(
          `${escapeRegExp(person.name)}\\s+(https?:\\/\\/(?:www\\.)?linkedin\\.com\\/in\\/[^\\s,]+)`,
          "i"
        )
      );
      if (match) linkedinById.set(person.contactId, match[1].replace(/[),.;]+$/, ""));
    }
  }

  return people.map((person) => ({
    ...person,
    company: person.company || companyById.get(person.contactId) || null,
    linkedinUrl: person.linkedinUrl || linkedinById.get(person.contactId) || null,
  }));
}

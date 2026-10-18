import { CADENCE_DAYS, type CadenceInterval } from "../outreach/types";

export const CADENCE_RULE =
  "Repeat within cadence means the meeting date is on or before last touch date plus the cadence interval. Next-touch history is not kept.";

const CADENCES = new Set<CadenceInterval>(["weekly", "biweekly", "triweekly", "monthly", "quarterly", "none"]);

export interface MetricMeeting {
  id: string;
  startsAt: string;
  primaryContactId: string | null;
  strategyId: string | null;
  outcomeMark: "hit" | "partial" | "missed" | null;
  suggestedMark: "hit" | "partial" | "missed" | null;
  asksCovered: number;
  asksTotal: number;
}

export interface MetricContact {
  id: string;
  name: string;
  cadence: string | null;
  lastTouchDate: string | null;
  nextTouchDate: string | null;
}

export interface MetricTouch {
  contactId: string;
  touchedAt: string;
}

export interface MetricCommitment {
  contactId: string;
  direction: "mine" | "theirs";
  status: string;
  createdAt: string | null;
  doneAt: string | null;
}

export interface MetricStrategy {
  id: string;
  name: string;
}

export interface RelationshipMetrics {
  from: string;
  to: string;
  firstMeetings: number;
  repeatMeetings: number;
  repeatWithinCadence: number;
  commitmentsOpened: { mine: number; theirs: number };
  commitmentsClosed: { mine: number; theirs: number };
  commitmentsSince: string | null;
  markAgreement: { agree: number; total: number };
  byStrategy: Array<{
    id: string | null;
    name: string;
    meetings: number;
    hit: number;
    partial: number;
    missed: number;
    unmarked: number;
    asksCovered: number;
    asksTotal: number;
  }>;
  byPerson: Array<{
    id: string;
    name: string;
    meetings: number;
    firstMeeting: string;
    lastMeeting: string;
    avgDaysBetween: number | null;
    openTheirs: number;
    openMine: number;
    nextTouchDate: string | null;
    nextTouchOverdue: boolean;
  }>;
}

function etDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function metricsWindow(days: number, today: string): { days: number; from: string; to: string } {
  const span = days === 30 || days === 180 ? days : 90;
  return { days: span, from: addDays(today, -(span - 1)), to: today };
}

function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function inWindow(iso: string | null, from: string, to: string): boolean {
  if (!iso) return false;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : etDateKey(iso);
  return day >= from && day <= to;
}

function daysBetween(earlier: string, later: string): number {
  const [ay, am, ad] = earlier.split("-").map(Number);
  const [by, bm, bd] = later.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function isFirstMeeting(meeting: MetricMeeting, touches: MetricTouch[]): boolean {
  if (!meeting.primaryContactId) return false;
  const start = Date.parse(meeting.startsAt);
  return !touches.some(
    (touch) => touch.contactId === meeting.primaryContactId && Date.parse(touch.touchedAt) < start
  );
}

export function isWithinCadence(meeting: MetricMeeting, contact: MetricContact | undefined): boolean {
  if (!contact?.lastTouchDate) return false;
  if (!contact.cadence || !CADENCES.has(contact.cadence as CadenceInterval) || contact.cadence === "none") {
    return false;
  }
  const days = CADENCE_DAYS[contact.cadence as Exclude<CadenceInterval, "none">];
  const due = addDays(contact.lastTouchDate, days);
  return etDateKey(meeting.startsAt) <= due;
}

export function computeRelationshipMetrics(input: {
  from: string;
  to: string;
  today: string;
  meetings: MetricMeeting[];
  contacts: MetricContact[];
  touches: MetricTouch[];
  commitments: MetricCommitment[];
  strategies: MetricStrategy[];
}): RelationshipMetrics {
  const contactById = new Map(input.contacts.map((contact) => [contact.id, contact]));
  const strategyName = new Map(input.strategies.map((strategy) => [strategy.id, strategy.name]));
  let firstMeetings = 0;
  let repeatMeetings = 0;
  let repeatWithinCadence = 0;
  let agree = 0;
  let compared = 0;

  const strategyRows = new Map<
    string,
    RelationshipMetrics["byStrategy"][number]
  >();
  const ensureStrategy = (id: string | null) => {
    const key = id ?? "";
    const existing = strategyRows.get(key);
    if (existing) return existing;
    const row = {
      id,
      name: id ? strategyName.get(id) ?? "Strategy" : "No strategy",
      meetings: 0,
      hit: 0,
      partial: 0,
      missed: 0,
      unmarked: 0,
      asksCovered: 0,
      asksTotal: 0,
    };
    strategyRows.set(key, row);
    return row;
  };

  const personMeetings = new Map<string, string[]>();

  for (const meeting of input.meetings) {
    const first = isFirstMeeting(meeting, input.touches);
    if (first) firstMeetings += 1;
    else {
      repeatMeetings += 1;
      const contact = meeting.primaryContactId ? contactById.get(meeting.primaryContactId) : undefined;
      if (isWithinCadence(meeting, contact)) repeatWithinCadence += 1;
    }
    if (meeting.outcomeMark && meeting.suggestedMark) {
      compared += 1;
      if (meeting.outcomeMark === meeting.suggestedMark) agree += 1;
    }
    const strategy = ensureStrategy(meeting.strategyId);
    strategy.meetings += 1;
    if (meeting.outcomeMark) strategy[meeting.outcomeMark] += 1;
    else strategy.unmarked += 1;
    strategy.asksCovered += meeting.asksCovered;
    strategy.asksTotal += meeting.asksTotal;
    if (meeting.primaryContactId) {
      const dates = personMeetings.get(meeting.primaryContactId) ?? [];
      dates.push(etDateKey(meeting.startsAt));
      personMeetings.set(meeting.primaryContactId, dates);
    }
  }

  const opened = { mine: 0, theirs: 0 };
  const closed = { mine: 0, theirs: 0 };
  let undated = false;
  let earliest: string | null = null;
  const openByContact = new Map<string, { mine: number; theirs: number }>();
  for (const item of input.commitments) {
    if (!item.createdAt) undated = true;
    else {
      const day = etDateKey(item.createdAt);
      if (!earliest || day < earliest) earliest = day;
    }
    const side = item.direction === "mine" ? "mine" : "theirs";
    if (inWindow(item.createdAt, input.from, input.to)) opened[side] += 1;
    if (item.status === "done" && inWindow(item.doneAt, input.from, input.to)) closed[side] += 1;
    if (item.status !== "done") {
      const tally = openByContact.get(item.contactId) ?? { mine: 0, theirs: 0 };
      tally[side] += 1;
      openByContact.set(item.contactId, tally);
    }
  }

  const byPerson: RelationshipMetrics["byPerson"] = [];
  for (const [id, dates] of personMeetings) {
    const contact = contactById.get(id);
    const sorted = [...dates].sort();
    let avgDaysBetween: number | null = null;
    if (sorted.length >= 2) {
      let sum = 0;
      for (let index = 1; index < sorted.length; index += 1) {
        sum += daysBetween(sorted[index - 1], sorted[index]);
      }
      avgDaysBetween = Math.round(sum / (sorted.length - 1));
    }
    const open = openByContact.get(id) ?? { mine: 0, theirs: 0 };
    byPerson.push({
      id,
      name: contact?.name ?? "Unknown",
      meetings: sorted.length,
      firstMeeting: sorted[0],
      lastMeeting: sorted[sorted.length - 1],
      avgDaysBetween,
      openTheirs: open.theirs,
      openMine: open.mine,
      nextTouchDate: contact?.nextTouchDate ?? null,
      nextTouchOverdue: Boolean(contact?.nextTouchDate && contact.nextTouchDate < input.today),
    });
  }
  byPerson.sort((a, b) => b.lastMeeting.localeCompare(a.lastMeeting) || a.name.localeCompare(b.name));

  const byStrategy = [...strategyRows.values()].sort(
    (a, b) => b.meetings - a.meetings || a.name.localeCompare(b.name)
  );

  return {
    from: input.from,
    to: input.to,
    firstMeetings,
    repeatMeetings,
    repeatWithinCadence,
    commitmentsOpened: opened,
    commitmentsClosed: closed,
    commitmentsSince: undated ? earliest ?? input.today : null,
    markAgreement: { agree, total: compared },
    byStrategy,
    byPerson,
  };
}

/**
 * Send-a-nudge planner. Pure helpers shared by the admin screen, the send
 * route, and the Friday dispatcher. No database or AI calls in this file.
 */

export const FAMILY_TIME_ZONE = "America/New_York";
export const NUDGE_NOTE_DEFAULT = "Quick look at what matters most this week. The rest can wait.";
export const BLURB_WORD_CAP = 25;

export type NudgeScheduleChoice = "now" | "fri" | "weekly";

/** Stored schedule. `now` sends immediately. */
export type NudgeSchedule =
  | "now"
  | { at: string }
  | { recurring: "weekly"; day: "fri"; time: "08:00"; nextAt: string };

export type NudgeStatus = "draft" | "scheduled" | "sent";

export type NudgeRecord = {
  id: string;
  createdBy: string;
  recipients: string[];
  stageIds: string[];
  todoIds: string[];
  note: string;
  schedule: NudgeSchedule;
  status: NudgeStatus;
  createdAt: string;
  sentAt: string | null;
  lastError: string | null;
};

export type NudgePerson = {
  id: string;
  name: string;
  firstName: string;
  initials: string;
  email: string | null;
  role: string;
  avatarUrl: string | null;
  defaultOn: boolean;
};

export type NudgeStageItem = {
  id: string;
  title: string;
  sub: string;
  flag: string;
  hot: boolean;
  defaultOn: boolean;
  blurb: string;
};

export type DueTone = "overdue" | "soon" | "later";

export type NudgeTodoItem = {
  id: string;
  ownerId: string;
  title: string;
  dateLabel: string;
  dueLabel: string;
  daysUntil: number | null;
  tone: DueTone;
  defaultOn: boolean;
  blurb: string;
};

export type NudgeCatalog = {
  people: NudgePerson[];
  stages: NudgeStageItem[];
  todos: NudgeTodoItem[];
  noteDefault: string;
  trackerBase: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function calendarParts(date: Date, timeZone = FAMILY_TIME_ZONE): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) bag[part.type] = part.value;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    weekday: bag.weekday ?? "",
  };
}

export function isoInZone(date: Date, timeZone = FAMILY_TIME_ZONE): string {
  const parts = calendarParts(date, timeZone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/** UTC instant for a wall-clock time in the family zone. */
export function zonedUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone = FAMILY_TIME_ZONE,
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(guess)) bag[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(bag.year),
    Number(bag.month) - 1,
    Number(bag.day),
    Number(bag.hour),
    Number(bag.minute),
    Number(bag.second),
  );
  return new Date(guess.getTime() - (asUtc - guess.getTime()));
}

function addUtcDays(year: number, month: number, day: number, add: number): { year: number; month: number; day: number } {
  const next = new Date(Date.UTC(year, month - 1, day + add));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

/** Next Friday 8:00am in the family zone, strictly after `now`. Today counts when it is still before 8. */
export function nextFridayAt8(now = new Date(), timeZone = FAMILY_TIME_ZONE): Date {
  const start = calendarParts(now, timeZone);
  for (let add = 0; add < 14; add++) {
    const day = addUtcDays(start.year, start.month, start.day, add);
    const at = zonedUtc(day.year, day.month, day.day, 8, 0, timeZone);
    if (calendarParts(at, timeZone).weekday === "Fri" && at.getTime() > now.getTime()) return at;
  }
  throw new Error("Could not find the next Friday 8 am");
}

export function weekRange(now = new Date(), timeZone = FAMILY_TIME_ZONE): { start: string; end: string } {
  const today = isoInZone(now, timeZone);
  const [year, month, day] = today.split("-").map(Number);
  const utc = new Date(Date.UTC(year!, month! - 1, day!));
  const dow = utc.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const start = new Date(utc);
  start.setUTCDate(start.getUTCDate() + mondayOffset);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const iso = (value: Date) =>
    `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
  return { start: iso(start), end: iso(end) };
}

export function daysBetween(startIso: string, endIso: string): number {
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${endIso}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.round((end - start) / 86400000);
}

export function daysUntilDue(dueIso: string | null, now = new Date(), timeZone = FAMILY_TIME_ZONE): number | null {
  if (!dueIso || !/^\d{4}-\d{2}-\d{2}$/.test(dueIso)) return null;
  return daysBetween(isoInZone(now, timeZone), dueIso);
}

export function dueLabel(days: number | null): string {
  if (days == null) return "No date";
  if (days < 0) {
    const n = -days;
    return `${n} day${n === 1 ? "" : "s"} overdue`;
  }
  if (days === 0) return "Due today";
  if (days <= 7) return `Due in ${days} day${days === 1 ? "" : "s"}`;
  return "Due later";
}

export function dueTone(days: number | null): DueTone {
  if (days != null && days < 0) return "overdue";
  if (days != null && days <= 7) return "soon";
  return "later";
}

export function shortMonthDay(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
  const [, month, day] = iso.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[(month ?? 1) - 1]} ${day}`;
}

export function stageFlagForRange(
  stage: { start: string; end: string; isMilestone: boolean },
  now = new Date(),
): { label: string; hot: boolean } {
  const today = isoInZone(now);
  const week = weekRange(now);
  const inThisWeek = stage.start <= week.end && stage.end >= week.start;
  if (stage.isMilestone && inThisWeek) return { label: "This week", hot: true };
  if (!stage.isMilestone && stage.end >= week.start && stage.end <= week.end && stage.start <= today) {
    return { label: "This week", hot: true };
  }
  if (stage.end < today) return { label: "Overdue", hot: true };
  const span = daysBetween(stage.start, stage.end);
  if (stage.start <= today && span >= 150) return { label: "Ongoing", hot: false };
  if (stage.start <= today && daysBetween(stage.start, today) <= 14 && span < 80) {
    return { label: "Started", hot: false };
  }
  if (stage.start <= today) {
    const weeks = Math.max(1, Math.round(daysBetween(today, stage.end) / 7));
    return { label: `Ends in ${weeks} week${weeks === 1 ? "" : "s"}`, hot: false };
  }
  const weeks = Math.max(1, Math.round(daysBetween(today, stage.start) / 7));
  return { label: `Starts in ${weeks} week${weeks === 1 ? "" : "s"}`, hot: false };
}

export function isCurrentWeekMilestone(
  stage: { start: string; end: string; isMilestone: boolean },
  now = new Date(),
): boolean {
  if (!stage.isMilestone) return false;
  const week = weekRange(now);
  return stage.start <= week.end && stage.end >= week.start;
}

/** In progress, recently overdue, due soon, or a milestone inside eight weeks. */
export function includeOnNudgeTimeline(
  stage: { start: string; end: string; isMilestone: boolean; done: boolean },
  now = new Date(),
): boolean {
  if (stage.done) return false;
  const today = isoInZone(now);
  if (stage.isMilestone) {
    const until = daysBetween(today, stage.start);
    return until >= -7 && until <= 56;
  }
  if (stage.end < today) return daysBetween(stage.end, today) <= 21;
  if (stage.start <= today) return true;
  return daysBetween(today, stage.start) <= 42;
}

export function defaultPersonOn(role: string): boolean {
  return role !== "super_admin" && role !== "guest";
}

export function recipientStatus(on: boolean, selectedTodos: number): string {
  if (!on) return "not sending";
  if (selectedTodos <= 0) return "timeline only";
  return `${selectedTodos} to-do${selectedTodos === 1 ? "" : "s"} selected`;
}

export function nudgeSubject(todoCount: number, stageCount: number): string {
  const todos = todoCount > 0 ? `${todoCount} to-do${todoCount === 1 ? "" : "s"}` : "";
  const stages = stageCount > 0 ? `${stageCount} timeline stage${stageCount === 1 ? "" : "s"}` : "";
  if (todos && stages) return `This week: ${todos} and ${stages}`;
  if (todos) return `This week: ${todos}`;
  if (stages) return `This week: ${stages}`;
  return "This week";
}

export function personWillReceive(on: boolean, stageCount: number, ownTodos: number): boolean {
  return on && (stageCount > 0 || ownTodos > 0);
}

export function nudgeSummary(recipients: number, stages: number, todos: number): string {
  const can = recipients > 0 && (stages > 0 || todos > 0);
  if (!can) return "Select recipients and at least one item";
  return `${recipients} recipient${recipients === 1 ? "" : "s"} · ${stages} timeline stage${stages === 1 ? "" : "s"} · ${todos} to-do${todos === 1 ? "" : "s"}`;
}

export function sendButtonLabel(choice: NudgeScheduleChoice, sent: boolean): string {
  if (sent) return choice === "now" ? "Sent ✓" : "Scheduled ✓";
  if (choice === "fri") return "Schedule";
  if (choice === "weekly") return "Schedule weekly";
  return "Send";
}

export function trackerHref(site: string, hasTodos: boolean, hasStages: boolean): string {
  const base = site.replace(/\/$/, "");
  if (hasTodos) return `${base}/?tab=projects&pm=todos`;
  if (hasStages) return `${base}/?tab=projects&pm=timeline`;
  return `${base}/?tab=projects`;
}

export function scheduleFromChoice(choice: NudgeScheduleChoice, now = new Date()): NudgeSchedule {
  if (choice === "now") return "now";
  const at = nextFridayAt8(now).toISOString();
  if (choice === "weekly") return { recurring: "weekly", day: "fri", time: "08:00", nextAt: at };
  return { at };
}

export function scheduleIsDue(schedule: NudgeSchedule, now = new Date()): boolean {
  if (schedule === "now") return true;
  if ("at" in schedule) return Date.parse(schedule.at) <= now.getTime();
  return Date.parse(schedule.nextAt) <= now.getTime();
}

export function advanceWeekly(schedule: NudgeSchedule, now = new Date()): NudgeSchedule {
  if (schedule === "now" || "at" in schedule) return schedule;
  const after = new Date(Math.max(now.getTime(), Date.parse(schedule.nextAt)) + 60_000);
  return { ...schedule, nextAt: nextFridayAt8(after).toISOString() };
}

export function clampBlurb(raw: string): string {
  const cleaned = raw
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/!+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean).slice(0, BLURB_WORD_CAP);
  const text = words.join(" ").replace(/[.]+$/g, "");
  if (!text) return "";
  return `${text}.`;
}

export function fallbackBlurb(title: string): string {
  const name = title.replace(/[.!?]+$/g, "").trim() || "This item";
  return clampBlurb(`${name} is on the plan this week. A small step now keeps it moving.`);
}

export function firstName(displayName: string): string {
  const part = displayName.trim().split(/\s+/)[0];
  return part || displayName.trim() || "there";
}

export function stillCurrentIds(selected: string[], liveIds: Iterable<string>): string[] {
  const live = new Set(liveIds);
  return selected.filter((id) => live.has(id));
}

const ROLE_ORDER = ["student", "sibling", "parent", "super_admin", "guest"];

export function personSortKey(role: string, name: string): string {
  const rank = ROLE_ORDER.indexOf(role);
  return `${rank === -1 ? 9 : rank}-${name.toLowerCase()}`;
}

export type NudgeEmailItem = {
  title: string;
  sub: string;
  blurb: string;
  date?: string;
  hot?: boolean;
};

export type NudgeEmailDraft = {
  to: string;
  toName: string;
  firstName: string;
  subject: string;
  note: string;
  stages: NudgeEmailItem[];
  todos: NudgeEmailItem[];
  trackerUrl: string;
};

export function composeRecipientEmails(
  input: {
    recipients: string[];
    stageIds: string[];
    todoIds: string[];
    note: string;
    catalog: NudgeCatalog;
  },
): { emails: { personId: string; email: NudgeEmailDraft }[]; skipped: { id: string; reason: string }[] } {
  const people = new Map(input.catalog.people.map((person) => [person.id, person]));
  const stageIds = new Set(stillCurrentIds(input.stageIds, input.catalog.stages.map((stage) => stage.id)));
  const todoIds = new Set(stillCurrentIds(input.todoIds, input.catalog.todos.map((todo) => todo.id)));
  const stages = input.catalog.stages.filter((stage) => stageIds.has(stage.id));
  const emails: { personId: string; email: NudgeEmailDraft }[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const id of input.recipients) {
    const person = people.get(id);
    if (!person) continue;
    const todos = input.catalog.todos.filter((todo) => todo.ownerId === id && todoIds.has(todo.id));
    if (!personWillReceive(true, stages.length, todos.length)) {
      skipped.push({ id, reason: "Nothing selected for this person" });
      continue;
    }
    if (!person.email) {
      skipped.push({ id, reason: "No email address" });
      continue;
    }
    emails.push({
      personId: id,
      email: {
        to: person.email,
        toName: person.name,
        firstName: person.firstName,
        subject: nudgeSubject(todos.length, stages.length),
        note: input.note.trim(),
        stages: stages.map((stage) => ({
          title: stage.title,
          sub: stage.sub,
          blurb: stage.blurb,
        })),
        todos: todos.map((todo) => ({
          title: todo.title,
          sub: todo.dueLabel,
          blurb: todo.blurb,
          date: todo.dateLabel === "—" ? "" : todo.dateLabel,
          hot: todo.tone === "overdue",
        })),
        trackerUrl: trackerHref(input.catalog.trackerBase, todos.length > 0, stages.length > 0),
      },
    });
  }
  return { emails, skipped };
}

export function catalogWithBlurbs(catalog: NudgeCatalog, blurbs: Map<string, string>): NudgeCatalog {
  return {
    ...catalog,
    stages: catalog.stages.map((stage) => ({ ...stage, blurb: blurbs.get(stage.id) || stage.blurb })),
    todos: catalog.todos.map((todo) => ({ ...todo, blurb: blurbs.get(todo.id) || todo.blurb })),
  };
}

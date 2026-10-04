/** Activities four-stage track — Gather, Shape, Plan, Application Prep. */

import {
  commonAppTime,
  createActivity,
  currentGrade,
  emptyJournal,
  gradeCells,
  newId,
  recallPeriods,
  resolveClassOf,
  type ActivitiesJournal,
  type Activity,
  type ActivityCategoryId,
  type ActivityThread,
} from "./activities-journal";

export const TRACK_GRADES = [6, 7, 8, 9, 10, 11, 12] as const;
export type TrackGrade = (typeof TRACK_GRADES)[number];

export type TrackCell = "e" | "d" | "n" | "p";

export type TrackIntent = "keep" | "up" | "finish";

export type TrackType =
  | "other"
  | "arts"
  | "sport"
  | "eng"
  | "work"
  | "service"
  | "family"
  | "project";

export type TrackPrepStatus = "draft" | "ready";

export type TrackActivity = {
  id: string;
  name: string;
  thread: string | null;
  start: number;
  still: boolean;
  end: number;
  type: TrackType;
  answers: Record<string, string>;
  role: string;
  org: string;
  desc: string;
  hours: string;
  weeks: string;
  college: "" | "yes" | "no";
  status: TrackPrepStatus;
  icon?: string;
};

export type TrackThread = { id: string; name: string };

export type TrackPlanStep = {
  id: string;
  actId: string;
  year: 11 | 12;
  lens: string;
  text: string;
};

export type TrackProject = {
  id: string;
  title: string;
  partner: string;
  outcome: string;
  when: "" | "11" | "12";
  why: string;
};

export type TrackIntents = Record<string, TrackIntent>;

export type ActivitiesTrack = {
  acts: TrackActivity[];
  threads: TrackThread[];
  plans: TrackPlanStep[];
  intents: TrackIntents;
  projects: TrackProject[];
};

export type TrackStageId = "gather" | "shape" | "plan" | "prep";

export const TRACK_TYPES: { id: TrackType; label: string }[] = [
  { id: "other", label: "Nothing in particular" },
  { id: "arts", label: "Performing or creating" },
  { id: "sport", label: "Sports and training" },
  { id: "eng", label: "Building or designing" },
  { id: "work", label: "Working a job" },
  { id: "service", label: "Helping others" },
  { id: "family", label: "Caring for family" },
  { id: "project", label: "Starting something of my own" },
];

export const TRACK_TYPE_QUESTIONS: Record<Exclude<TrackType, "other">, [string, string][]> = {
  arts: [
    [
      "What is the hardest piece or part you have performed?",
      "A piece, a role or a performance that stretched you.",
    ],
    [
      "Any auditions, chairs, solos or ensembles you earned a place in?",
      "A placement, a chair, a solo, an ensemble you auditioned for.",
    ],
  ],
  sport: [
    [
      "What level, rank or belt have you reached, and when?",
      "A belt, rank, level or team, and the year you got there.",
    ],
    ["What is a result you are proud of?", "A placement, a record, a game, a personal best."],
  ],
  eng: [
    [
      "What part of the build or design was yours?",
      "A subsystem, a design decision, a piece of code or hardware.",
    ],
    [
      "What did you test, and what did you change after testing?",
      "A test that failed and the change you made next.",
    ],
  ],
  work: [
    [
      "What do you do that your manager relies on you for?",
      "A task, a shift, a responsibility that is handed to you.",
    ],
    [
      "Any raise, promotion or added responsibility?",
      "A raise, a new title, a new task you were trusted with.",
    ],
  ],
  service: [
    [
      "Who did your work help, and how many?",
      "The people or groups it reached, and roughly how many.",
    ],
    [
      "What would not have happened without the group's work?",
      "An event or service that needed the group to run.",
    ],
  ],
  family: [
    [
      "What do you take care of, and how many hours a week?",
      "A sibling, meals, translating, a family business.",
    ],
    ["What would your family do without it?", "What would be harder or left undone."],
  ],
  project: [
    [
      "What made you start it?",
      "A problem you noticed, something missing, a person who inspired you.",
    ],
    [
      "Who said yes, and how did you get them to?",
      "A partner, a venue, a sponsor, and how you asked.",
    ],
  ],
};

export const STEP_UP_LENSES = [
  {
    id: "deeper",
    label: "Go deeper",
    q: "How could you go deeper in this?",
    ex: "For example: a harder level, a competition, a longer commitment.",
  },
  {
    id: "lead",
    label: "Lead",
    q: "What role could you take on, or who could you teach?",
    ex: "For example: section leader, or teaching younger members what you wish you had known.",
  },
  {
    id: "outside",
    label: "Outside school",
    q: "Where could you do this beyond school?",
    ex: "For example: a community group, a summer program, a local employer.",
  },
  {
    id: "make",
    label: "Make something",
    q: "What could you build, record or show?",
    ex: "For example: a project, a performance, a portfolio piece.",
  },
  {
    id: "connect",
    label: "Connect",
    q: "Who could you work with that you do not know yet?",
    ex: "For example: a mentor, another school, a professional in the field.",
  },
] as const;

export const KEEP_LENSES = [
  {
    id: "k1",
    label: "Stay consistent",
    q: "What will help you keep this going at the same level?",
    ex: "A schedule, a practice routine, a way to balance it with other commitments.",
  },
  {
    id: "k2",
    label: "Keep it fresh",
    q: "What would keep it interesting for another year?",
    ex: "A new piece, a new part of the work, a different role on the team.",
  },
  {
    id: "k3",
    label: "Watch out for",
    q: "What could get in the way, and how could you handle it?",
    ex: "A heavier course load, a schedule conflict, losing motivation.",
  },
] as const;

export const FINISH_LENSES = [
  {
    id: "f1",
    label: "End well",
    q: "What do you want to have done before you finish?",
    ex: "A last performance, a final project, a goodbye to your team.",
  },
  {
    id: "f2",
    label: "Hand it on",
    q: "Who could take over what you do, and how could you help them?",
    ex: "Training a younger member, writing down how you run things.",
  },
  {
    id: "f3",
    label: "Carry it forward",
    q: "What from this will you take into other things?",
    ex: "A skill, a habit, a connection that stays after you stop.",
  },
  {
    id: "f4",
    label: "Why finish",
    q: "Why are you choosing to finish?",
    ex: "A new priority, a time limit, a goal you reached.",
  },
] as const;

export const INTENT_PILLS: { id: TrackIntent; label: string; mode: string }[] = [
  { id: "keep", label: "Keep going", mode: "Keeping going" },
  { id: "up", label: "Step up", mode: "Stepping up" },
  { id: "finish", label: "Finish", mode: "Finishing" },
];

export type TrackQuestion = { layer: string; id: string; q: string; ex: string };

export function emptyTrack(): ActivitiesTrack {
  return { acts: [], threads: [], plans: [], intents: {}, projects: [] };
}

export function nowGrade(journal: ActivitiesJournal, now: Date = new Date()): number {
  return currentGrade(resolveClassOf(journal.profile?.classOf, now), now) ?? 11;
}

export function activityStates(
  activity: TrackActivity,
  steps: TrackPlanStep[],
  intents: TrackIntents,
  now: number,
): TrackCell[] {
  const i12 = intents[`${activity.id}:12`];
  const has12 = steps.some((p) => p.actId === activity.id && p.year === 12);
  return TRACK_GRADES.map((g) => {
    if (g < activity.start) return "e";
    if (g <= now) {
      if (activity.still) return g === now ? "n" : "d";
      return g <= activity.end ? "d" : "e";
    }
    return activity.still && i12 !== "finish" && (i12 || has12) ? "p" : "e";
  });
}

export function mergeStates(list: TrackCell[][]): TrackCell[] {
  const rank: Record<TrackCell, number> = { e: 0, p: 1, d: 2, n: 3 };
  return TRACK_GRADES.map((_, i) =>
    list.reduce<TrackCell>((best, st) => (rank[st[i]!] > rank[best] ? st[i]! : best), "e"),
  );
}

export function yearsInStates(st: TrackCell[]): number {
  return st.filter((c) => c === "d" || c === "n").length;
}

export function threadLengthBar(
  states: TrackCell[],
  cell = 56,
  gap = 3,
): { left: number; width: number; years: number } {
  const pitch = cell + gap;
  const idx = states
    .map((c, i) => (c === "d" || c === "n" ? i : -1))
    .filter((i) => i >= 0);
  if (!idx.length) return { left: 0, width: 0, years: 0 };
  const first = idx[0]!;
  const last = idx[idx.length - 1]!;
  return {
    left: first * pitch,
    width: (last - first + 1) * pitch - gap,
    years: idx.length,
  };
}

export function questionsFor(activity: TrackActivity, now: number): TrackQuestion[] {
  const yrs = (activity.still ? now : activity.end) - activity.start + 1;
  const q: TrackQuestion[] = [];
  const add = (layer: string, id: string, text: string, ex: string) =>
    q.push({ layer, id, q: text, ex });
  add(
    "What you do",
    "week",
    "Walk through a typical week. What do you actually do?",
    "Rehearse, practice drills, build and test, run a meeting, train newer members.",
  );
  add(
    "What you do",
    "resp",
    "What are you responsible for that would not happen without you?",
    "A section, a piece of equipment, a schedule, a set of customers, a younger sibling's pickup.",
  );
  add(
    "What you do",
    "with",
    "Who do you work with, and what is your part?",
    "The size of the group and the specific job that is yours in it.",
  );
  add(
    "What changed",
    "diff",
    "What is different because you were there?",
    "A result, a fix, a new member who stayed, an event that ran better.",
  );
  add(
    "What changed",
    "nums",
    "Any numbers?",
    "A placement, a score, a record, how many people, how much money, how many hours.",
  );
  add(
    "What changed",
    "helped",
    "Who did it help, and how?",
    "Teammates, younger students, customers, your family, a community group.",
  );
  const extra = activity.type === "other" ? [] : TRACK_TYPE_QUESTIONS[activity.type] ?? [];
  extra.forEach((x, i) => add("A few more", `type${i}`, x[0], x[1]));
  if (yrs >= 2) {
    add(
      "Growth",
      "g1",
      "How is what you do now different from your first year?",
      "More responsibility, harder music, a bigger role, teaching instead of learning.",
    );
    add(
      "Growth",
      "g2",
      "What can you do now that you could not when you started?",
      "A skill, a technique, a level, a kind of problem you can solve.",
    );
    add(
      "Growth",
      "g3",
      "What is the hardest thing you have done in this activity?",
      "A competition, a failure you recovered from, a deadline, a difficult piece or build.",
    );
    add(
      "Growth",
      "g4",
      "Tell about a time something went wrong. What did you do?",
      "A broken part before a competition, a missed cue, a conflict on the team.",
    );
  }
  add(
    "Things you started",
    "s1",
    "Did you start, fix, organize or change anything here?",
    "A new practice routine, a fundraiser, a tool, a way of doing things that stuck.",
  );
  add(
    "Things you started",
    "s2",
    "Have you taught or helped anyone newer than you?",
    "A newer member, a new hire, a teammate or a younger student.",
  );
  add(
    "Why it matters",
    "m1",
    "Why does this matter to you?",
    "What you get from it that you do not get anywhere else.",
  );
  if (yrs >= 3) {
    add(
      "Why it matters",
      "m2",
      "Why have you kept doing it?",
      "What made you stay when you could have quit.",
    );
  }
  add("Why it matters", "m3", "What have you gotten better at?", "Skills, habits, how you work with people.");
  add(
    "Why it matters",
    "m4",
    "How have you changed since you started?",
    "How you think, act or see yourself differently.",
  );
  add(
    "Why it matters",
    "m5",
    "What is one moment you remember?",
    "A specific day, performance, game, build or conversation.",
  );
  add(
    "Why it matters",
    "m6",
    "Does this connect to what you want to study or do?",
    "A skill, interest or question that carries into your intended major.",
  );
  return q;
}

export function nudgeFor(question: TrackQuestion, text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const words = t.split(/\s+/).length;
  if (/\b(we|our|us)\b/i.test(t) && !/\b(I|my|me)\b/.test(t)) return "What was your part?";
  if (/passionate|learned a lot|hard work|teamwork|leadership skills/i.test(t)) {
    return "What is a specific example?";
  }
  if (question.layer === "What changed" && !/\d/.test(t)) {
    return "Any numbers? A placement, a count, a score, a time.";
  }
  if (words < 8 && question.id !== "nums") return "Can you say more? What did that look like?";
  return null;
}

export function answeredCount(activity: TrackActivity, now: number): number {
  const qs = questionsFor(activity, now);
  return qs.filter((q) => (activity.answers[q.id] ?? "").trim()).length;
}

export function lensesForIntent(intent: TrackIntent | undefined) {
  if (intent === "keep") return KEEP_LENSES;
  if (intent === "finish") return FINISH_LENSES;
  return STEP_UP_LENSES;
}

export function lensLabel(id: string): string {
  const all = [...STEP_UP_LENSES, ...KEEP_LENSES, ...FINISH_LENSES];
  return all.find((l) => l.id === id)?.label ?? "";
}

export function copyTrackNotes(acts: TrackActivity[]): string {
  return acts
    .map((a, i) => `${i + 1}. ${a.name}\n${a.role} | ${a.org}\n${a.desc}`)
    .join("\n\n");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

const TYPES = new Set<string>(TRACK_TYPES.map((t) => t.id));
const INTENTS = new Set<string>(["keep", "up", "finish"]);

function normalizeAct(raw: unknown, now: number): TrackActivity | null {
  const row = asRecord(raw);
  if (!row) return null;
  const name = asOptionalString(row.name);
  if (!name) return null;
  const startRaw = typeof row.start === "number" ? row.start : Number(row.start);
  const start = Number.isInteger(startRaw) && startRaw >= 6 && startRaw <= 11 ? startRaw : 9;
  const still = row.still !== false;
  const endRaw = typeof row.end === "number" ? row.end : Number(row.end);
  const end = Number.isInteger(endRaw) && endRaw >= 6 && endRaw <= 12 ? endRaw : still ? now : start;
  const type: TrackType = typeof row.type === "string" && TYPES.has(row.type) ? (row.type as TrackType) : "other";
  const answers: Record<string, string> = {};
  const rawAnswers = asRecord(row.answers);
  if (rawAnswers) {
    for (const [k, v] of Object.entries(rawAnswers)) {
      if (typeof v === "string") answers[k] = v;
    }
  }
  const college =
    row.college === "yes" || row.college === "no" ? row.college : "";
  const status: TrackPrepStatus = row.status === "ready" ? "ready" : "draft";
  const thread = asOptionalString(row.thread) ?? null;
  const icon = asOptionalString(row.icon);
  return {
    id: asOptionalString(row.id) ?? newId("activity"),
    name,
    thread,
    start,
    still,
    end: still ? now : end,
    type,
    answers,
    role: asString(row.role),
    org: asString(row.org),
    desc: asString(row.desc).slice(0, 150),
    hours: asString(row.hours).replace(/\D/g, ""),
    weeks: asString(row.weeks).replace(/\D/g, ""),
    college,
    status,
    ...(icon ? { icon } : {}),
  };
}

export function normalizeTrack(raw: unknown, now = 11): ActivitiesTrack {
  const row = asRecord(raw);
  if (!row) return emptyTrack();
  const threads = Array.isArray(row.threads)
    ? row.threads
        .map((t) => {
          const r = asRecord(t);
          if (!r) return null;
          const name = asOptionalString(r.name);
          if (!name) return null;
          return { id: asOptionalString(r.id) ?? newId("thread"), name };
        })
        .filter((t): t is TrackThread => Boolean(t))
    : [];
  const threadIds = new Set(threads.map((t) => t.id));
  const acts = Array.isArray(row.acts)
    ? row.acts
        .map((a) => normalizeAct(a, now))
        .filter((a): a is TrackActivity => Boolean(a))
        .map((a) => (a.thread && !threadIds.has(a.thread) ? { ...a, thread: null } : a))
    : [];
  const plans = Array.isArray(row.plans)
    ? row.plans
        .map((p) => {
          const r = asRecord(p);
          if (!r) return null;
          const actId = asOptionalString(r.actId);
          const text = asString(r.text).trim();
          if (!actId || !text) return null;
          const year = r.year === 12 || r.year === "12" ? 12 : 11;
          return {
            id: asOptionalString(r.id) ?? newId("plan"),
            actId,
            year: year as 11 | 12,
            lens: asOptionalString(r.lens) ?? "deeper",
            text,
          } satisfies TrackPlanStep;
        })
        .filter((p): p is TrackPlanStep => Boolean(p))
    : [];
  const intents: TrackIntents = {};
  const rawIntents = asRecord(row.intents);
  if (rawIntents) {
    for (const [k, v] of Object.entries(rawIntents)) {
      if (typeof v === "string" && INTENTS.has(v)) intents[k] = v as TrackIntent;
    }
  }
  const projects = Array.isArray(row.projects)
    ? row.projects
        .map((p) => {
          const r = asRecord(p);
          if (!r) return null;
          const when = r.when === "11" || r.when === "12" ? r.when : "";
          return {
            id: asOptionalString(r.id) ?? newId("idea"),
            title: asString(r.title),
            partner: asString(r.partner),
            outcome: asString(r.outcome),
            when,
            why: asString(r.why),
          } satisfies TrackProject;
        })
        .filter((p): p is TrackProject => Boolean(p))
    : [];
  return { acts, threads, plans, intents, projects };
}

const CATEGORY_TO_TYPE: Record<ActivityCategoryId, TrackType> = {
  "school-club": "other",
  athletics: "sport",
  "arts-music-theater": "arts",
  "volunteering-community-service": "service",
  "paid-work": "work",
  internship: "work",
  research: "eng",
  "independent-project-business": "project",
  "academic-enrichment": "other",
  "other-coursework-training": "other",
  "family-household-responsibilities": "family",
  "faith-community-group": "service",
  "hobby-personal-pursuit": "other",
  other: "other",
};

function startEndFromActivity(activity: Activity, now: number): { start: number; still: boolean; end: number } {
  const cells = gradeCells(activity);
  const grades = TRACK_GRADES.filter((g) => cells[g]);
  if (!grades.length) {
    return { start: 9, still: activity.ongoing, end: activity.ongoing ? now : 9 };
  }
  const start = grades[0]!;
  const last = grades[grades.length - 1]!;
  const still = activity.ongoing && last >= now;
  return { start, still, end: still ? now : last };
}

export function migrateTrackFromJournal(
  journal: ActivitiesJournal,
  now: number,
): ActivitiesTrack {
  const existing = normalizeTrack(journal.track, now);
  if (existing.acts.length) return existing;
  const threads = (journal.threads ?? []).map((t) => ({ id: t.id, name: t.name }));
  const acts: TrackActivity[] = journal.activities
    .filter((a) => !a.archived)
    .map((a) => {
      const span = startEndFromActivity(a, now);
      const time = commonAppTime(a);
      const answers: Record<string, string> = {};
      if (a.reflections?.whyMatters) answers.m1 = a.reflections.whyMatters;
      if (a.reflections?.skills) answers.m3 = a.reflections.skills;
      if (a.reflections?.growth) answers.m4 = a.reflections.growth;
      if (a.reflections?.memorable) answers.m5 = a.reflections.memorable;
      const desc = (a.responsibilities ?? "").slice(0, 150);
      const hours = time.hoursPerWeek != null ? String(Math.round(time.hoursPerWeek)) : "";
      const weeks = time.weeksPerYear != null ? String(Math.round(time.weeksPerYear)) : "";
      return {
        id: a.id,
        name: a.name,
        thread: a.threadId ?? null,
        start: span.start,
        still: span.still,
        end: span.end,
        type: CATEGORY_TO_TYPE[a.category] ?? "other",
        answers,
        role: a.role ?? "",
        org: a.organization ?? "",
        desc,
        hours,
        weeks,
        college: "",
        status: "draft" as const,
        ...(a.icon ? { icon: a.icon } : {}),
      };
    });
  const threadIds = new Set(threads.map((t) => t.id));
  return {
    acts: acts.map((a) => (a.thread && !threadIds.has(a.thread) ? { ...a, thread: null } : a)),
    threads,
    plans: [],
    intents: {},
    projects: [],
  };
}

const TYPE_TO_CATEGORY: Record<TrackType, ActivityCategoryId> = {
  other: "other",
  arts: "arts-music-theater",
  sport: "athletics",
  eng: "other",
  work: "paid-work",
  service: "volunteering-community-service",
  family: "family-household-responsibilities",
  project: "independent-project-business",
};

export function cellStyle(cell: TrackCell): { background: string; border: string } {
  if (cell === "d") return { background: "var(--color-accent-tint-2)", border: "0" };
  if (cell === "n") return { background: "var(--color-accent)", border: "0" };
  if (cell === "p") {
    return {
      background:
        "repeating-linear-gradient(135deg, transparent 0 3px, var(--color-accent-border) 3px 4px)",
      border: "1px dashed var(--color-accent-border)",
    };
  }
  return { background: "var(--color-surface)", border: "0" };
}

export function gradeHeaders(now: number): {
  n: string;
  tag: string;
  num: string;
  fg: string;
  l: string;
}[] {
  return TRACK_GRADES.map((g) => ({
    n: String(g),
    tag: g === now ? "NOW" : "",
    num: g === now ? "var(--text-accent)" : "var(--color-text)",
    fg: g === now ? "var(--text-accent)" : "var(--text-subtle)",
    l: g === now ? `${g} now` : String(g),
  }));
}

export function activitySpanText(activity: TrackActivity): string {
  return activity.still ? `still doing it` : `through ${activity.end}th`;
}

export function longestActivityStates(
  acts: TrackActivity[],
  steps: TrackPlanStep[],
  intents: TrackIntents,
  now: number,
): TrackCell[] | null {
  let best: TrackCell[] | null = null;
  let bestYears = -1;
  for (const activity of acts) {
    const st = activityStates(activity, steps, intents, now);
    const y = yearsInStates(st);
    if (y > bestYears) {
      bestYears = y;
      best = st;
    }
  }
  return best;
}

export function stageMarks(track: ActivitiesTrack): { shape: string; plan: string; prep: string } {
  const loose = track.acts.some((a) => !a.thread);
  return {
    shape: loose ? "" : " ✓",
    plan: hasRestOfHighSchool(track) && track.projects.length ? " ✓" : "",
    prep: track.acts.every((a) => a.status === "ready") ? " ✓" : "",
  };
}

export function projectStarters(threads: TrackThread[]): string[] {
  const names = threads.map((t) => t.name.trim()).filter(Boolean);
  return [
    names[0] ? `Teach a younger group what you know about ${names[0].toLowerCase()}` : "",
    names[1] ? `Make something in ${names[1].toLowerCase()} and show it publicly` : "",
    "Start a small service or event for your community",
    "Organize a drive or fundraiser with a local group",
  ].filter(Boolean);
}

export function setJournalTrack(
  journal: ActivitiesJournal,
  track: ActivitiesTrack,
): ActivitiesJournal {
  return { ...journal, track };
}

export function applyTrackToJournal(
  journal: ActivitiesJournal,
  track: ActivitiesTrack,
  now: number,
  clock: Date = new Date(),
): ActivitiesJournal {
  const stamp = clock.toISOString();
  const classOf = resolveClassOf(journal.profile?.classOf, clock);
  const existingThreads = journal.threads ?? [];
  const threads: ActivityThread[] = track.threads.map((t) => {
    const prev = existingThreads.find((x) => x.id === t.id);
    if (prev) {
      if (prev.name === t.name) return prev;
      return { ...prev, name: t.name, updatedAt: stamp };
    }
    return { id: t.id, name: t.name, createdAt: stamp, updatedAt: stamp };
  });
  const byId = new Map(journal.activities.map((a) => [a.id, a]));
  const activities = [...journal.activities];
  for (const act of track.acts) {
    const prev = byId.get(act.id);
    if (prev) {
      const next: Activity = {
        ...prev,
        name: act.name,
        ongoing: act.still,
        updatedAt: stamp,
      };
      next.role = act.role || undefined;
      next.organization = act.org || undefined;
      next.responsibilities = act.desc || undefined;
      if (act.icon) next.icon = act.icon;
      if (act.thread) next.threadId = act.thread;
      else delete next.threadId;
      const idx = activities.findIndex((a) => a.id === act.id);
      if (idx >= 0) activities[idx] = next;
    } else {
      const created = createActivity({
        id: act.id,
        name: act.name,
        category: TYPE_TO_CATEGORY[act.type],
        organization: act.org || undefined,
        role: act.role || undefined,
        responsibilities: act.desc || undefined,
        ongoing: act.still,
        periods: recallPeriods(
          classOf,
          {
            sinceGrade: act.start,
            untilGrade: act.still ? undefined : act.end,
            stillDoing: act.still,
          },
          clock,
        ),
        icon: act.icon,
      });
      if (act.thread) created.threadId = act.thread;
      activities.push(created);
    }
  }
  return {
    ...journal,
    activities,
    threads,
    track,
  };
}

export function hasRestOfHighSchool(track: ActivitiesTrack): boolean {
  return track.plans.length > 0 || Object.keys(track.intents).length > 0;
}

export function nextBand(
  track: ActivitiesTrack,
): { kicker: string; text: string; btn: string; go: TrackStageId | "rest" | "project" | "copy" } {
  const loose = track.acts.filter((a) => !a.thread);
  const allReady = track.acts.length > 0 && track.acts.every((a) => a.status === "ready");
  if (loose.length) {
    return {
      kicker: "Next · Shape",
      text: `${loose[0]!.name} is not in a thread yet. Where does it belong?`,
      btn: "Shape",
      go: "shape",
    };
  }
  if (!hasRestOfHighSchool(track)) {
    return {
      kicker: "Next · The rest of high school",
      text: "Choose what you want to do with each activity in 11th and 12th grade.",
      btn: "Plan it",
      go: "rest",
    };
  }
  if (!track.projects.length) {
    return {
      kicker: "Next · A project of your own",
      text: "Is there something you could start yourself, with a partner outside school?",
      btn: "Think about it",
      go: "project",
    };
  }
  if (!allReady) {
    const n = track.acts.filter((a) => a.status !== "ready").length;
    return {
      kicker: "Next · Application Prep",
      text: `${n} activities still need notes gathered.`,
      btn: "Application Prep",
      go: "prep",
    };
  }
  return {
    kicker: "Done for now",
    text: "Your plan is made and your notes are gathered.",
    btn: "Copy my notes",
    go: "copy",
  };
}

/** Used by tests and callers that only have a journal blob. */
export function journalOrEmpty(raw: unknown): ActivitiesJournal {
  if (raw && typeof raw === "object") return raw as ActivitiesJournal;
  return emptyJournal();
}

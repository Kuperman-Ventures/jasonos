/**
 * How the book gets made: step copy, live status, and the next action for Jason.
 * Names and dates come from PHASES in plan.ts. Do not duplicate them here.
 */
import { currentPhase, isPhaseDone, PHASES, PROJECT_START } from "./plan";
import {
  FYB_BIBLE_KINDS,
  FYB_DRIFT_KINDS,
  type FybDecision,
  type FybEntry,
  type FybEntryKind,
} from "./types";

export const SKETCH_DOC_URL =
  "https://docs.google.com/document/d/1czIPVv8rweBidLIfPrhEv8E5lDJ7hMqV8L-qX7x5Sj8/edit";
export const SKETCH_NOTE =
  "Scenes written before Phase 4 are sketches. Any story fact a sketch commits to is logged as a provisional decision. After the outline, each sketch is kept, rewritten or cut to fit it.";
export const PROVISIONAL_SUFFIX = " (Provisional, from the opening scene draft)";

export type ProcessStepStatus = "done" | "now" | "next" | "later";
export type ProcessPartStatus = "done" | "waiting" | "not-posted";
export type NextStepKind = "decide" | "wait" | "review" | "write" | "none";

export type ProcessPart = {
  week: number;
  label: string;
  why: string;
  decisionKey?: string;
  entryKinds?: FybEntryKind[];
};

export type ProcessStep = {
  phase: number;
  purpose: string;
  you: string;
  claude: string;
  inApp: { label: string; href: string | null };
  parts?: ProcessPart[];
};

export type NextStep = {
  kind: NextStepKind;
  title: string;
  detail: string;
  href: string | null;
  hrefLabel?: string;
  stepOf?: { index: number; total: number };
};

export const PROCESS_STEPS: ProcessStep[] = [
  {
    phase: 1,
    purpose: "Set how the book sounds before any story work.",
    you: "Shared writing samples and did two calibration rounds.",
    claude: "Built the Style Profile and the AI Tells Checklist.",
    inApp: { label: "Reference", href: "/projects/fuck-you-batman/reference" },
  },
  {
    phase: 2,
    purpose: "Decide the story from the ending backward: the ending first, then the people, then the rules.",
    you: "Pick an option on each decision card, or write your own, and press Record. Approve or request changes on the Story Bible and Drift Map.",
    claude:
      "Posts 3-4 options per decision each Monday, with holes and a recommendation. Drafts the Story Bible and Drift Map in Week 3.",
    inApp: { label: "Decisions", href: "/projects/fuck-you-batman/decisions" },
    parts: [
      {
        week: 1,
        label: "Ending and hidden purpose",
        why: "Every clue and every stage of the drift points at it.",
        decisionKey: "ending-and-hidden-purpose",
      },
      {
        week: 1,
        label: "Comparable novel to read",
        why: "A model for a machine narrator while you plan.",
        decisionKey: "reading-pick",
      },
      {
        week: 2,
        label: "Hero",
        why: "Who he is, and why he relies on the computer without checking its work.",
        decisionKey: "hero",
      },
      {
        week: 2,
        label: "Computer",
        why: "Its original job, what it can sense, and how it talks.",
        decisionKey: "computer",
      },
      {
        week: 2,
        label: "Relationship before the drift",
        why: "What the reader watches go wrong.",
        decisionKey: "relationship",
      },
      {
        week: 2,
        label: "Second story track",
        why: "The detective whose view does not match the computer's account.",
        decisionKey: "second-track",
      },
      {
        week: 2,
        label: "Tense and narration frame",
        why: "When and why the computer is telling the story.",
        decisionKey: "tense",
      },
      {
        week: 3,
        label: "Story Bible",
        why: "Characters, places, technology rules and timeline, kept consistent.",
        entryKinds: FYB_BIBLE_KINDS,
      },
      {
        week: 3,
        label: "Drift Map",
        why: "The stages of the madness by chapter, with the clues and machine patterns in each.",
        entryKinds: FYB_DRIFT_KINDS,
      },
    ],
  },
  {
    phase: 3,
    purpose: "Turn the Drift Map into a writing plan.",
    you: "Approve or request changes on each scene card.",
    claude: "Drafts one card per scene: what happens, what the computer reports, what is actually true, and its drift stage.",
    inApp: { label: "Scenes", href: "/projects/fuck-you-batman/scenes" },
  },
  {
    phase: 4,
    purpose: "Test the voice on real chapters before the full draft.",
    you: "Write chapters 1-3 in Google Docs.",
    claude: "Reviews them against the Style Profile and proposes any rule changes for you to approve.",
    inApp: { label: "Scenes", href: "/projects/fuck-you-batman/scenes" },
  },
  {
    phase: 5,
    purpose: "Write the full first draft, in order, against the outline.",
    you: "Write about 1,000 words a session, 5 sessions a week, in Google Docs.",
    claude: "Reviews each week's pages on Sunday and emails up to 8 findings.",
    inApp: { label: "Scenes", href: "/projects/fuck-you-batman/scenes" },
  },
  {
    phase: 6,
    purpose: "Revise in five passes, one problem at a time: structure, drift and clues, character, language, AI tells.",
    you: "Revise in Google Docs, one pass at a time.",
    claude: "Lists the issues for each pass before you start it.",
    inApp: { label: "Scenes", href: "/projects/fuck-you-batman/scenes" },
  },
  {
    phase: 7,
    purpose: "Find out when readers stop trusting the computer.",
    you: "Send the draft to 3 to 5 readers.",
    claude: "Turns their feedback into one list of fixes.",
    inApp: { label: "Google Docs", href: null },
  },
  {
    phase: 8,
    purpose: "Finish the manuscript.",
    you: "Make the final fixes.",
    claude: "Runs the last AI tells check.",
    inApp: { label: "Google Docs", href: null },
  },
];

export function isProvisional(decision: Pick<FybDecision, "question">): boolean {
  return decision.question.endsWith(PROVISIONAL_SUFFIX);
}

export function displayQuestion(decision: Pick<FybDecision, "question">): string {
  return isProvisional(decision)
    ? decision.question.slice(0, -PROVISIONAL_SUFFIX.length)
    : decision.question;
}

function mondayUtc(week: number): Date {
  const startMs = Date.parse(`${PROJECT_START}T12:00:00Z`);
  return new Date(startMs + (week - 1) * 7 * 86_400_000);
}

function shortMonthDay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Monday of a plan week, e.g. "Mon Oct 19". PROJECT_START is week 1. */
export function weekMonday(week: number): string {
  const date = mondayUtc(week);
  const weekday = date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  return `${weekday} ${shortMonthDay(date)}`;
}

export function weekRangeLabel(week: number): string {
  const monday = mondayUtc(week);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  return `${shortMonthDay(monday)} - ${shortMonthDay(sunday)}`;
}

export function phaseDateLabel(phaseNumber: number): string {
  const phase = PHASES.find((p) => p.number === phaseNumber);
  if (!phase) return "";
  if (phase.number === 1) {
    return `Done ${shortMonthDay(new Date(`${phase.end}T12:00:00Z`))}`;
  }
  const start = shortMonthDay(new Date(`${phase.start}T12:00:00Z`));
  const end = shortMonthDay(new Date(`${phase.end}T12:00:00Z`));
  return `${start} - ${end}`;
}

export function stepStatus(phase: number, week: number): ProcessStepStatus {
  const def = PHASES.find((p) => p.number === phase);
  if (!def) return "later";
  if (isPhaseDone(def, week)) return "done";
  const current = currentPhase(week);
  if (current?.number === phase) return "now";
  if (current && phase === current.number + 1) return "next";
  return "later";
}

export function partStatus(
  part: ProcessPart,
  decisions: FybDecision[],
  entries: FybEntry[]
): ProcessPartStatus {
  if (part.decisionKey) {
    const row = decisions.find((d) => d.decision_key === part.decisionKey);
    if (!row) return "not-posted";
    return row.status === "decided" ? "done" : "waiting";
  }
  if (part.entryKinds?.length) {
    const rows = entries.filter((entry) => part.entryKinds!.includes(entry.kind));
    if (rows.length === 0) return "not-posted";
    return rows.every((entry) => entry.status === "approved") ? "done" : "waiting";
  }
  return "not-posted";
}

export function entryTabHref(kind: FybEntryKind): string {
  if (FYB_BIBLE_KINDS.includes(kind)) return "/projects/fuck-you-batman/bible";
  if (FYB_DRIFT_KINDS.includes(kind)) return "/projects/fuck-you-batman/drift";
  if (kind === "scene") return "/projects/fuck-you-batman/scenes";
  return "/projects/fuck-you-batman/reference";
}

export function partWaitingHref(part: ProcessPart): string {
  if (part.decisionKey) return `/projects/fuck-you-batman/decisions#${part.decisionKey}`;
  const kind = part.entryKinds?.[0];
  return kind ? entryTabHref(kind) : "/projects/fuck-you-batman";
}

function firstChapterDocUrl(entries: FybEntry[]): string | null {
  for (const entry of entries) {
    if (entry.kind !== "scene") continue;
    const url = entry.data.doc_url;
    if (typeof url === "string" && /^https:\/\//i.test(url)) return url;
  }
  return null;
}

function writeHref(entries: FybEntry[]): string {
  return firstChapterDocUrl(entries) ?? SKETCH_DOC_URL;
}

function writeDetail(phaseNumber: number): string {
  if (phaseNumber === 4) return "Draft chapters 1-3.";
  if (phaseNumber === 6) return "Work on the current revision pass.";
  return "About 1,000 words. Your weekly target is 5,000.";
}

export function nextStep(week: number, decisions: FybDecision[], entries: FybEntry[]): NextStep {
  const due = decisions
    .filter((d) => d.status === "open" && d.week <= week)
    .slice()
    .sort((a, b) => a.week - b.week || a.sort_order - b.sort_order);
  if (due.length > 0) {
    const first = due[0];
    const thisWeek = decisions.filter((d) => d.week === week);
    const total = thisWeek.length;
    const index = thisWeek.filter((d) => d.status === "decided").length + 1;
    return {
      kind: "decide",
      title: `Decide: ${displayQuestion(first)}`,
      detail: `Decision ${index} of ${total} this week. Pick an option or write your own, then press Record.`,
      href: `/projects/fuck-you-batman/decisions#${first.decision_key}`,
      hrefLabel: "Open decision",
      stepOf: { index, total },
    };
  }

  const revising = entries.find((entry) => entry.status === "changes_requested");
  if (revising) {
    return {
      kind: "wait",
      title: `Claude is revising: ${revising.title}`,
      detail: "You asked for changes. The revised version will be posted for your approval.",
      href: entryTabHref(revising.kind),
      hrefLabel: "View",
    };
  }

  const drafts = entries.filter((entry) => entry.status === "draft" && entry.kind !== "reference");
  if (drafts.length > 0) {
    const first = drafts[0];
    return {
      kind: "review",
      title: `Review: ${first.title}`,
      detail: `${drafts.length} draft${drafts.length === 1 ? "" : "s"} waiting. Approve each one, or request changes with a note.`,
      href: entryTabHref(first.kind),
      hrefLabel: "Review drafts",
    };
  }

  const phase = currentPhase(week);
  if (phase && (phase.number === 4 || phase.number === 5 || phase.number === 6)) {
    return {
      kind: "write",
      title: "Write today",
      detail: writeDetail(phase.number),
      href: writeHref(entries),
      hrefLabel: "Open Google Docs",
    };
  }

  let detail = `Claude posts the Week ${week + 1} work on ${weekMonday(week + 1)}.`;
  let href: string | null = null;
  let hrefLabel: string | undefined;
  if (phase && (phase.number === 2 || phase.number === 3)) {
    detail += " You can sketch scenes in the FYB doc in the meantime.";
    href = SKETCH_DOC_URL;
    hrefLabel = "Open sketch doc";
  }
  return {
    kind: "none",
    title: "Nothing waiting on you",
    detail,
    href,
    hrefLabel,
  };
}

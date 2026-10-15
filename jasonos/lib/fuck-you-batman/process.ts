/**
 * How the book gets made: step copy, live status, and the next action for Jason.
 * Names and dates come from PHASES in plan.ts. Do not duplicate them here.
 */
import { currentPhase, isPhaseDone, PHASES, PROJECT_START } from "./plan";
import {
  FYB_BIBLE_KINDS,
  FYB_DRIFT_KINDS,
  FYB_SCENE_KINDS,
  type FybDecision,
  type FybEntry,
  type FybEntryKind,
} from "./types";

export const SKETCH_DOC_URL =
  "https://docs.google.com/document/d/1czIPVv8rweBidLIfPrhEv8E5lDJ7hMqV8L-qX7x5Sj8/edit";
export const SKETCH_NOTE =
  "Scenes written before Phase 4 are sketches. Any story fact a sketch commits to is logged as a provisional decision. After the outline, each sketch is kept, rewritten or cut to fit it.";
export const PROVISIONAL_SUFFIX = " (Provisional, from the opening scene draft)";

export const QUESTION_SETS: Record<string, string> = {
  hero: "The Hero",
  computer: "The Computer (Moon)",
  relationship: "Hero and Moon Before the Drift",
  "second-track": "The Detective",
  tense: "Tense and Narration Frame",
  drift: "The Drift Map",
  outline: "The Outline",
};

export type ProcessStepStatus = "done" | "now" | "next" | "later";
export type ProcessPartStatus = "done" | "waiting" | "not-posted";
export type NextStepKind = "answer" | "decide" | "wait" | "review" | "write" | "none";

export type ProcessPart = {
  week: number;
  label: string;
  why: string;
  decisionKey?: string;
  questionSet?: string;
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

export type PartStatusResult = {
  status: ProcessPartStatus;
  answered?: number;
  total?: number;
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
    purpose: "Work out the story from the ending backward: the ending first, then the people, then the rules of the world.",
    you: "Answer each question in your own words on the Decisions tab. Approve the Story Bible, or request changes.",
    claude:
      "Posts the week's questions each Monday, with why each one matters. Asks follow-up questions where answers conflict or leave gaps. Builds the Story Bible from your answers, in your words.",
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
        label: "The Hero",
        why: "Who Dustin is, what he wants, what shaped him, and why he trusts Moon without checking.",
        questionSet: "hero",
      },
      {
        week: 2,
        label: "The Computer (Moon)",
        why: "Who built Moon, what it can sense, what it values, and how it talks.",
        questionSet: "computer",
      },
      {
        week: 3,
        label: "Hero and Moon Before the Drift",
        why: "What the reader watches go wrong.",
        questionSet: "relationship",
      },
      {
        week: 3,
        label: "The Detective",
        why: "The second story track, whose view does not match Moon's account.",
        questionSet: "second-track",
      },
      {
        week: 3,
        label: "Tense and Narration Frame",
        why: "When, why and to whom Moon is telling the story.",
        questionSet: "tense",
      },
      {
        week: 4,
        label: "Story Bible",
        why: "Your answers, organized so the facts stay consistent across the book.",
        entryKinds: FYB_BIBLE_KINDS,
      },
      {
        week: 4,
        label: "Drift Map questions",
        why: "The stages of Moon's madness, and what the reader believes at each one.",
        questionSet: "drift",
      },
    ],
  },
  {
    phase: 3,
    purpose: "Turn your answers into a chapter-by-chapter writing plan.",
    you: "Answer the outline questions. Approve the Drift Map and the scene cards, or request changes.",
    claude: "Builds the Drift Map and the scene cards from your answers, in your words, and asks about the gaps.",
    inApp: { label: "Decisions", href: "/projects/fuck-you-batman/decisions" },
    parts: [
      {
        week: 5,
        label: "Drift Map",
        why: "Your stages, clues and voice changes, organized by chapter.",
        entryKinds: FYB_DRIFT_KINDS,
      },
      {
        week: 5,
        label: "Outline questions",
        why: "For each chapter: what happens, what Moon reports, and what is actually true.",
        questionSet: "outline",
      },
      {
        week: 6,
        label: "Scene cards",
        why: "One card per scene, built from your outline answers.",
        entryKinds: FYB_SCENE_KINDS,
      },
    ],
  },
  {
    phase: 4,
    purpose: "Test the voice on real chapters before the full draft.",
    you: "Write chapters 1-3 in Google Docs.",
    claude: "Reviews them against the Style Profile and asks questions about anything that breaks a rule.",
    inApp: { label: "Scenes", href: "/projects/fuck-you-batman/scenes" },
  },
  {
    phase: 5,
    purpose: "Write the full first draft, in order, against the outline.",
    you: "Write about 1,000 words a session, 5 sessions a week, in Google Docs.",
    claude: "Reviews each week's pages on Sunday and emails up to 8 questions about specific lines.",
    inApp: { label: "Scenes", href: "/projects/fuck-you-batman/scenes" },
  },
  {
    phase: 6,
    purpose: "Revise in five passes, one problem at a time: structure, drift and clues, character, language, AI tells.",
    you: "Revise in Google Docs, one pass at a time.",
    claude: "Asks questions about the places each pass should look at, before you start it.",
    inApp: { label: "Scenes", href: "/projects/fuck-you-batman/scenes" },
  },
  {
    phase: 7,
    purpose: "Find out when readers stop trusting the computer.",
    you: "Send the draft to 3 to 5 readers and decide which feedback to act on.",
    claude: "Groups their feedback by chapter and by problem.",
    inApp: { label: "Google Docs", href: null },
  },
  {
    phase: 8,
    purpose: "Finish the manuscript.",
    you: "Make the final fixes.",
    claude: "Runs the last AI tells check and lists the lines it flags.",
    inApp: { label: "Google Docs", href: null },
  },
];

export function questionSet(decision: Pick<FybDecision, "decision_key">): string | null {
  const match = decision.decision_key.match(/^(.*)-(\d+)$/);
  if (!match) return null;
  const prefix = match[1];
  return Object.prototype.hasOwnProperty.call(QUESTION_SETS, prefix) ? prefix : null;
}

export function isQuestion(decision: Pick<FybDecision, "decision_key" | "options">): boolean {
  return decision.options.length === 0 && questionSet(decision) !== null;
}

export function setProgress(
  decisions: FybDecision[],
  set: string
): { answered: number; total: number } {
  const cards = decisions.filter((d) => isQuestion(d) && questionSet(d) === set);
  return {
    answered: cards.filter((d) => d.status === "decided").length,
    total: cards.length,
  };
}

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

/** Inclusive Mon-Sun range for a plan week, e.g. "Oct 19 - Oct 25". */
export function weekRange(week: number): string {
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
): PartStatusResult {
  if (part.decisionKey) {
    const row = decisions.find((d) => d.decision_key === part.decisionKey);
    if (!row) return { status: "not-posted" };
    return { status: row.status === "decided" ? "done" : "waiting" };
  }
  if (part.questionSet) {
    const progress = setProgress(decisions, part.questionSet);
    if (progress.total === 0) return { status: "not-posted", answered: 0, total: 0 };
    if (progress.answered === progress.total) {
      return { status: "done", answered: progress.answered, total: progress.total };
    }
    return { status: "waiting", answered: progress.answered, total: progress.total };
  }
  if (part.entryKinds?.length) {
    const rows = entries.filter((entry) => part.entryKinds!.includes(entry.kind));
    if (rows.length === 0) return { status: "not-posted" };
    return { status: rows.every((entry) => entry.status === "approved") ? "done" : "waiting" };
  }
  return { status: "not-posted" };
}

export function entryTabHref(kind: FybEntryKind): string {
  if (FYB_BIBLE_KINDS.includes(kind)) return "/projects/fuck-you-batman/bible";
  if (FYB_DRIFT_KINDS.includes(kind)) return "/projects/fuck-you-batman/drift";
  if (kind === "scene") return "/projects/fuck-you-batman/scenes";
  return "/projects/fuck-you-batman/reference";
}

export function partWaitingHref(part: ProcessPart): string {
  if (part.decisionKey) return `/projects/fuck-you-batman/decisions#${part.decisionKey}`;
  if (part.questionSet) return `/projects/fuck-you-batman/decisions#set-${part.questionSet}`;
  const kind = part.entryKinds?.[0];
  return kind ? entryTabHref(kind) : "/projects/fuck-you-batman";
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
    const href = `/projects/fuck-you-batman/decisions#${first.decision_key}`;
    if (isQuestion(first)) {
      const set = questionSet(first)!;
      const progress = setProgress(decisions, set);
      return {
        kind: "answer",
        title: displayQuestion(first),
        detail: `Question ${progress.answered + 1} of ${progress.total} in ${QUESTION_SETS[set]}. Answer in your own words.`,
        href,
        hrefLabel: "Answer this question",
        stepOf: { index: progress.answered + 1, total: progress.total },
      };
    }
    return {
      kind: "decide",
      title: `Decide: ${displayQuestion(first)}`,
      detail: "Pick an option or write your own, then press Record.",
      href,
      hrefLabel: "Open decision",
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
      detail: `${drafts.length} entries built from your answers are waiting. Approve each one, or request changes with a note.`,
      href: entryTabHref(first.kind),
      hrefLabel: "Review",
    };
  }

  const phase = currentPhase(week);
  if (phase && (phase.number === 4 || phase.number === 5 || phase.number === 6)) {
    return {
      kind: "write",
      title: "Write today",
      detail: writeDetail(phase.number),
      href: SKETCH_DOC_URL,
      hrefLabel: "Open Google Docs",
    };
  }

  let detail = `Your next questions arrive ${weekMonday(week + 1)}.`;
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

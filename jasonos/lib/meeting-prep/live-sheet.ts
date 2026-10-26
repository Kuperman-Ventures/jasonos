import { callNumberLabel, type CallSheetBlock } from "./call-sheet";
import { FAMILY_LABELS, type PlaybookFamily, type PlaybookObjection, type PlaybookTimeBudget } from "./playbook-blocks";
import { REACTION_SHAPES, type Reaction } from "./reactions";
import type { MeetingPoint } from "../server-actions/meeting-points";

/** Ask and Close play after the conversation. Their ids never reach the server. */
export const SHEET_STEP_PREFIX = "sheet:";

export function isSheetStep(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith(SHEET_STEP_PREFIX));
}

export type BudgetKey = "expectations" | "rapport" | "main" | "close";

export interface BudgetSegment {
  key: BudgetKey;
  label: string;
  minutes: number;
}

export interface ReferenceItem {
  key: string;
  title: string;
  body: string | null;
  lines: Array<{ label: string; text: string }>;
}

export interface LiveSheetFeed {
  personName: string;
  playbookName: string | null;
  callLabel: string | null;
  budget: BudgetSegment[];
  /** Ids of the Then steps (ask, close), in order. */
  thenIds: string[];
  reference: ReferenceItem[];
  helpThem: string | null;
}

const BUDGET_ORDER: Array<{ key: BudgetKey; label: string }> = [
  { key: "expectations", label: "Expectations" },
  { key: "rapport", label: "Rapport" },
  { key: "main", label: "Conversation" },
  { key: "close", label: "Close" },
];

export function budgetSegments(budget: PlaybookTimeBudget | null | undefined): BudgetSegment[] {
  if (!budget) return [];
  return BUDGET_ORDER.flatMap(({ key, label }) => {
    const minutes = budget[key];
    return typeof minutes === "number" && minutes > 0 ? [{ key, label, minutes }] : [];
  });
}

export interface BudgetProgress {
  /** Index of the segment the clock is in; segments.length once past the budget. */
  index: number;
  /** 0 to 1 through the current segment. */
  fraction: number;
  /** Whole minutes past the total budget. */
  overMinutes: number;
  totalMinutes: number;
}

export function budgetProgress(segments: BudgetSegment[], elapsedSeconds: number): BudgetProgress {
  const total = segments.reduce((sum, segment) => sum + segment.minutes, 0);
  const elapsed = Math.max(0, elapsedSeconds) / 60;
  let start = 0;
  for (const [index, segment] of segments.entries()) {
    const end = start + segment.minutes;
    if (elapsed < end) {
      return { index, fraction: (elapsed - start) / segment.minutes, overMinutes: 0, totalMinutes: total };
    }
    start = end;
  }
  return {
    index: segments.length,
    fraction: 1,
    overMinutes: total ? Math.floor(elapsed - total) : 0,
    totalMinutes: total,
  };
}

/** One reaction per shape from the playbook objections, or none when a shape is missing. */
export function reactionsFromObjections(objections: PlaybookObjection[]): Reaction[] {
  const byShape = new Map<string, Reaction>();
  for (const row of objections) {
    if (byShape.has(row.shape) || !row.soundsLike.trim() || !row.pivot.trim()) continue;
    byShape.set(row.shape, { shape: row.shape, soundsLike: row.soundsLike, pivot: row.pivot });
  }
  if (byShape.size !== REACTION_SHAPES.length) return [];
  return REACTION_SHAPES.map((shape) => byShape.get(shape)!);
}

function stepPoint(
  id: string,
  position: number,
  kind: MeetingPoint["kind"],
  headline: string,
  detail: string | null,
  reactions: Reaction[]
): MeetingPoint {
  return {
    id,
    prepId: "",
    position,
    kind,
    headline,
    detail,
    state: "open",
    stateChangedAt: null,
    confirmedState: null,
    confirmedAt: null,
    listenFor: null,
    note: null,
    source: "script",
    editedByUser: false,
    sourceHint: null,
    prepareReactions: reactions.length > 0,
    reactions,
    observedReaction: null,
  };
}

function askDetail(block: CallSheetBlock): string | null {
  const parts = [block.body?.trim() || null];
  for (const line of block.lines) {
    if (line.text.trim()) parts.push(`${line.label ? `${line.label}: ` : ""}${line.text.trim()}`);
  }
  return parts.filter(Boolean).join("\n\n") || null;
}

/** Words from a sheet block for a rehearsal/live card. Empty blocks return null. */
export function blockDetail(block: CallSheetBlock): string | null {
  if (block.kind === "points" || block.kind === "after") return null;
  if (block.kind === "ask") return askDetail(block);
  if (block.kind === "lines") {
    const parts = block.lines
      .filter((line) => line.text.trim())
      .map((line) => (line.label.trim() ? `${line.label.trim()}\n${line.text.trim()}` : line.text.trim()));
    return parts.join("\n\n") || null;
  }
  return block.body?.trim() || null;
}

/** The ask and close blocks as steps after the conversation. Empty blocks are left out. */
export function thenSteps(blocks: CallSheetBlock[], objections: PlaybookObjection[], startPosition: number): MeetingPoint[] {
  const steps: MeetingPoint[] = [];
  const ask = blocks.find((block) => block.kind === "ask");
  const askText = ask ? askDetail(ask) : null;
  if (ask && askText) {
    steps.push(
      stepPoint(`${SHEET_STEP_PREFIX}${ask.key}`, startPosition + 1, "ask", ask.title, askText, reactionsFromObjections(objections))
    );
  }
  const close = blocks.find((block) => block.key === "close" && block.kind === "text");
  if (close?.body?.trim()) {
    steps.push(stepPoint(`${SHEET_STEP_PREFIX}${close.key}`, startPosition + 2, "point", close.title, close.body.trim(), []));
  }
  return steps;
}

const LIVE_REFERENCE_KEYS = ["who", "why", "what_how", "turn_to_me"];

/** Live keeps Who / Why / What and how / Turn to me in the side rail. */
export function referenceItems(blocks: CallSheetBlock[], mode: "live" | "rehearse"): ReferenceItem[] {
  // Rehearse plays filled blocks as cards — no separate reference copy.
  if (mode === "rehearse") return [];
  const picked = LIVE_REFERENCE_KEYS.flatMap((key) => blocks.filter((block) => block.key === key));
  return picked
    .map((block) => ({
      key: block.key,
      title: block.title,
      body: block.body?.trim() || null,
      lines: block.lines.filter((line) => line.text.trim()).map((line) => ({ label: line.label, text: line.text.trim() })),
    }))
    .filter((item) => item.body || item.lines.length);
}

export function helpThemLine(blocks: CallSheetBlock[]): string | null {
  for (const block of blocks) {
    if (block.kind !== "lines") continue;
    const line = block.lines.find((row) => /how i can help them/i.test(row.label) && row.text.trim());
    if (line) return line.text.trim();
  }
  return null;
}

/** Conversation points first, then the ask and close. Used on the real call. */
export function liveSteps(
  points: MeetingPoint[],
  blocks: CallSheetBlock[],
  objections: PlaybookObjection[]
): { steps: MeetingPoint[]; thenIds: string[] } {
  const last = points.reduce((max, point) => Math.max(max, point.position), 0);
  const then = thenSteps(blocks, objections, last);
  return { steps: [...points, ...then], thenIds: then.map((step) => step.id) };
}

/**
 * Rehearsal walks the sheet in order: every filled block is a card, and the conversation
 * points sit where the Points block is. Ask and Close land in Then.
 */
export function rehearseSteps(
  points: MeetingPoint[],
  blocks: CallSheetBlock[],
  objections: PlaybookObjection[]
): { steps: MeetingPoint[]; thenIds: string[] } {
  const steps: MeetingPoint[] = [];
  const thenIds: string[] = [];
  let position = points.reduce((max, point) => Math.max(max, point.position), 0);
  const nextPosition = () => {
    position += 1;
    return position;
  };
  let insertedPoints = false;

  for (const block of blocks) {
    if (block.kind === "after") continue;
    if (block.kind === "points") {
      steps.push(...points);
      insertedPoints = true;
      continue;
    }
    const detail = blockDetail(block);
    if (!detail) continue;
    const id = `${SHEET_STEP_PREFIX}${block.key}`;
    const kind: MeetingPoint["kind"] = block.kind === "ask" ? "ask" : "point";
    const reactions = kind === "ask" ? reactionsFromObjections(objections) : [];
    steps.push(stepPoint(id, nextPosition(), kind, block.title, detail, reactions));
    if (block.kind === "ask" || block.key === "close") thenIds.push(id);
  }

  if (!insertedPoints && points.length) {
    const thenSet = new Set(thenIds);
    const head = steps.filter((step) => !thenSet.has(step.id));
    const tail = steps.filter((step) => thenSet.has(step.id));
    return { steps: [...head, ...points, ...tail], thenIds };
  }

  return { steps, thenIds };
}

/** Everything Live and Rehearse need from a call sheet: the steps to play and the feed for the frame. */
export function buildLiveSheet(input: {
  blocks: CallSheetBlock[];
  playbook: {
    name: string | null;
    family: PlaybookFamily;
    timeBudget: PlaybookTimeBudget | null;
    objections: PlaybookObjection[];
  } | null;
  touchNumber: number;
  personName: string;
  points: MeetingPoint[];
  mode: "live" | "rehearse";
}): { steps: MeetingPoint[]; feed: LiveSheetFeed } {
  const objections = input.playbook?.objections ?? [];
  const { steps, thenIds } =
    input.mode === "rehearse"
      ? rehearseSteps(input.points, input.blocks, objections)
      : liveSteps(input.points, input.blocks, objections);
  const family = input.playbook?.family ?? null;
  return {
    steps,
    feed: {
      personName: input.personName,
      playbookName: input.playbook ? input.playbook.name?.trim() || FAMILY_LABELS[input.playbook.family] : null,
      callLabel: callNumberLabel(family, input.touchNumber),
      budget: budgetSegments(input.playbook?.timeBudget),
      thenIds,
      reference: referenceItems(input.blocks, input.mode),
      helpThem: helpThemLine(input.blocks),
    },
  };
}

/** Agenda headline above a point, or null when the point sits outside any agenda section. */
export function topicFor(points: Array<Pick<MeetingPoint, "id" | "kind" | "headline">>, id: string): string | null {
  const index = points.findIndex((point) => point.id === id);
  for (let at = index - 1; at >= 0; at -= 1) {
    if (points[at].kind === "agenda") return points[at].headline;
  }
  return null;
}

import {
  clampDetail,
  clampHeadline,
  clampListenFor,
  type PointKind,
  POINT_KINDS,
} from "../meeting-prep/points";
import { parseReactions, type Reaction } from "../meeting-prep/reactions";

const KIND_SET = new Set<string>(POINT_KINDS);

export const CALL_SHEET_TOOL_NAMES = [
  "build_call_sheet",
  "set_call_sheet",
  "create_sheet",
  "use_sheet_for_meeting",
  "mark_sheet_ready",
  "get_call_sheet",
  "get_person",
  "list_people",
  "list_upcoming_meeting_preps",
] as const;

/** Earlier names, kept registered for one release. */
export const MEETING_PLAN_TOOL_NAMES = [
  "build_meeting_plan",
  "accept_meeting_plan",
  "set_meeting_plan",
  "create_guide",
  "use_guide_for_meeting",
  "get_meeting_plan",
  "list_upcoming_meeting_preps",
] as const;

export type SheetBlockInput = {
  key: string;
  body?: string | null;
  lines?: Array<{ label?: string; text: string }>;
};

type SheetBlockShape = {
  key: string;
  title: string;
  kind: string;
  lines: Array<{ label: string }>;
};

/**
 * Refuses a set_call_sheet write before anything is saved: unknown block keys, blocks that
 * are not written here (points, After), lines on a text block, and line labels the block
 * does not have.
 */
export function validateSheetBlocks(
  blocks: SheetBlockShape[],
  inputs: SheetBlockInput[]
): { ok: true } | { ok: false; error: string } {
  const keys = blocks.map((block) => block.key).join(", ");
  for (const input of inputs) {
    const wanted = input.key.trim().toLowerCase();
    const block =
      blocks.find((row) => row.key.toLowerCase() === wanted) ??
      blocks.find((row) => row.title.trim().toLowerCase() === wanted);
    if (!block) return { ok: false, error: `No block "${input.key}" on this sheet. Blocks: ${keys}.` };
    if (block.kind === "after") return { ok: false, error: "After is written on Debrief, not with set_call_sheet." };
    if (block.kind === "points") {
      return { ok: false, error: `${block.title} holds points. Pass them as points, not as a block.` };
    }
    if (input.lines === undefined) continue;
    if (block.kind !== "lines") return { ok: false, error: `${block.title} takes a body, not lines.` };
    const labels = block.lines.map((line) => line.label.trim());
    const known = new Set(labels.map((label) => label.toLowerCase()));
    let unlabeled = 0;
    for (const line of input.lines) {
      const label = line.label?.trim() ?? "";
      if (!label) {
        unlabeled += 1;
        continue;
      }
      if (!known.has(label.toLowerCase())) {
        return {
          ok: false,
          error: `${block.title} has no line "${label}". Lines: ${labels.join(", ") || "none"}.`,
        };
      }
    }
    if (unlabeled > labels.length) {
      return { ok: false, error: `${block.title} has ${labels.length} lines; ${unlabeled} were given without labels.` };
    }
  }
  return { ok: true };
}

/**
 * Lines for a lines block after a write: each input line replaces the line with the same
 * label, or the line at its position when it has no label. Extra labeled lines are added.
 */
export function mergeSheetLines(
  existing: Array<{ label: string; text: string; sourceHint?: string | null }>,
  input: Array<{ label?: string; text: string }>
): Array<{ label: string; text: string }> {
  const next = existing.map((line) => ({ label: line.label, text: line.text }));
  let unlabeled = 0;
  for (const line of input) {
    const label = line.label?.trim() ?? "";
    const text = String(line.text ?? "").trim();
    const byLabel = label ? next.findIndex((row) => row.label.trim().toLowerCase() === label.toLowerCase()) : -1;
    if (byLabel >= 0) {
      next[byLabel] = { label: next[byLabel].label, text };
    } else if (!label && unlabeled < existing.length) {
      next[unlabeled] = { label: next[unlabeled].label, text };
      unlabeled += 1;
    } else {
      next.push({ label: label || "Line", text });
    }
  }
  return next;
}

export type PlanPointInput = {
  kind: string;
  headline: string;
  detail?: string | null;
  listen_for?: string | null;
  prepare_reactions?: boolean;
  reactions?: unknown;
};

function asKind(value: string): PointKind | null {
  return KIND_SET.has(value) ? (value as PointKind) : null;
}

/** Shared clamps for set_meeting_plan / create_guide point payloads. */
export function validatePlanPoints(points: PlanPointInput[]):
  | {
      ok: true;
      points: Array<{
        kind: PointKind;
        headline: string;
        detail: string | null;
        listenFor: string | null;
        prepareReactions: boolean;
        reactions: Reaction[] | null;
      }>;
    }
  | { ok: false; error: string } {
  if (!Array.isArray(points) || !points.length) {
    return { ok: false, error: "Provide at least one point." };
  }
  if (points.length > 20) return { ok: false, error: "At most 20 points." };
  const out: Array<{
    kind: PointKind;
    headline: string;
    detail: string | null;
    listenFor: string | null;
    prepareReactions: boolean;
    reactions: Reaction[] | null;
  }> = [];
  for (const row of points) {
    const kind = asKind(String(row.kind ?? ""));
    if (!kind) return { ok: false, error: `Unknown kind: ${row.kind}` };
    const headline = clampHeadline(String(row.headline ?? ""));
    if (!headline) {
      return { ok: false, error: "Each point needs a headline under 80 characters." };
    }
    const detail =
      typeof row.detail === "string" && row.detail.trim() ? clampDetail(row.detail) : null;
    const listenFor = clampListenFor(row.listen_for ?? null);
    let reactions: Reaction[] | null = null;
    if (row.reactions != null) {
      const parsed = parseReactions(JSON.stringify(row.reactions));
      if (!parsed) return { ok: false, error: "Reactions need all six shapes." };
      reactions = parsed;
    }
    out.push({
      kind,
      headline,
      detail,
      listenFor,
      prepareReactions: Boolean(row.prepare_reactions) || Boolean(reactions),
      reactions,
    });
  }
  return { ok: true, points: out };
}

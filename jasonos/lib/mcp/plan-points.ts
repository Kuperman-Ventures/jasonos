import {
  clampDetail,
  clampHeadline,
  clampListenFor,
  type PointKind,
  POINT_KINDS,
} from "../meeting-prep/points";
import { parseReactions, type Reaction } from "../meeting-prep/reactions";

const KIND_SET = new Set<string>(POINT_KINDS);

export const MEETING_PLAN_TOOL_NAMES = [
  "build_meeting_plan",
  "accept_meeting_plan",
  "set_meeting_plan",
  "create_guide",
  "use_guide_for_meeting",
  "get_meeting_plan",
  "list_upcoming_meeting_preps",
] as const;

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

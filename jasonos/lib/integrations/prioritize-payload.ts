/**
 * Pure Prioritize import payload helpers (no server-only) so unit tests can
 * cover defaults without hitting Settings / fetch.
 */
import { etDate } from "@/lib/commitments/logic";
import type { CommitmentView } from "@/lib/commitments/types";

/** Inbox lane in Prioritize — Jason assigns from here. */
export const PRIORITIZE_DEFAULT_TRACK_NAME = "Track 0";

function metricsForSection(section: CommitmentView["section"]): {
  importance: number;
  urgency: number;
  effort: number;
  enjoyment: number;
} {
  const effort = 4;
  const enjoyment = 3;
  switch (section) {
    case "overdue":
      return { importance: 8, urgency: 9, effort, enjoyment };
    case "due_today":
      return { importance: 7, urgency: 8, effort, enjoyment };
    case "coming_up":
      return { importance: 6, urgency: 5, effort, enjoyment };
    case "scheduled":
      return { importance: 6, urgency: 5, effort, enjoyment };
    default:
      return { importance: 5, urgency: 4, effort, enjoyment };
  }
}

function buildDescription(item: CommitmentView, prioritizeDue: string): string {
  const commitmentDue =
    item.due_date && item.due_date !== prioritizeDue
      ? `Commitment due ${item.due_date}`
      : item.due_date
        ? `Due ${item.due_date}`
        : "No commitment due date";
  const lines = [
    `To ${item.to}`,
    `Prioritize due ${prioritizeDue}`,
    commitmentDue,
    item.context ? item.context : null,
    item.source_url ? item.source_url : null,
    `JasonOS key: ${item.key}`,
  ].filter(Boolean);
  return lines.join("\n");
}

/** Payload for POST /api/import/jasonos-commitment — due today, Track 0. */
export function buildPrioritizeImportBody(
  item: CommitmentView,
  today = etDate()
): {
  external_key: string;
  title: string;
  description: string;
  due_date: string;
  track_name: string;
  project_name: null;
  tag_names: string[];
  metrics: ReturnType<typeof metricsForSection>;
} {
  return {
    external_key: item.key,
    title: item.promise.trim(),
    description: buildDescription(item, today),
    due_date: today,
    track_name: PRIORITIZE_DEFAULT_TRACK_NAME,
    project_name: null,
    tag_names: ["Work"],
    // Fresh exports land due today regardless of the commitment section.
    metrics: metricsForSection("due_today"),
  };
}

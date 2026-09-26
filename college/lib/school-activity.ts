/** Human-readable activity summaries for school field changes. */

import {
  interestLabel,
  visitLabel,
  statusLabel,
  trackLabel,
  type InterestLevel,
  type School,
  type VisitStatus,
  type ApplicationStatus,
  type AdmissionTrack,
} from "@/lib/types";
import { LIST_PHASES, type ListPhaseId } from "@/lib/list-phases";

export type SchoolActivityLine = {
  action: string;
  summary: string;
  detail?: Record<string, unknown>;
};

function phaseLabel(id: string): string {
  return LIST_PHASES.find((phase) => phase.id === id)?.label ?? id;
}

/**
 * Build activity lines for a school PATCH. One line per meaningful change.
 * Quiet fields (long research text, sources) are skipped so the log stays readable.
 */
export function schoolPatchActivityLines(
  before: School,
  patch: Record<string, unknown>,
): SchoolActivityLine[] {
  const name = before.name;
  const lines: SchoolActivityLine[] = [];

  if ("archived" in patch && typeof patch.archived === "boolean" && patch.archived !== before.archived) {
    lines.push({
      action: patch.archived ? "archive" : "restore",
      summary: patch.archived ? `Archived college “${name}”` : `Restored college “${name}”`,
      detail: { archived: patch.archived },
    });
  }

  if (
    "interestLevel" in patch &&
    typeof patch.interestLevel === "string" &&
    patch.interestLevel !== before.interestLevel
  ) {
    const next = interestLabel(patch.interestLevel as InterestLevel) || "Not set";
    const prev = interestLabel(before.interestLevel) || "Not set";
    lines.push({
      action: "update",
      summary: `Set interest for “${name}” to ${next}`,
      detail: { from: prev, to: next },
    });
  }

  if (
    "visitStatus" in patch &&
    typeof patch.visitStatus === "string" &&
    patch.visitStatus !== before.visitStatus
  ) {
    const next = visitLabel(patch.visitStatus as VisitStatus) || "Not set";
    lines.push({
      action: "update",
      summary: `Set visit status for “${name}” to ${next}`,
      detail: { visitStatus: patch.visitStatus },
    });
  }

  if ("visitDate" in patch && patch.visitDate !== before.visitDate) {
    const next =
      typeof patch.visitDate === "string" && patch.visitDate
        ? patch.visitDate
        : patch.visitDate === null
          ? "cleared"
          : null;
    if (next) {
      lines.push({
        action: "update",
        summary:
          next === "cleared"
            ? `Cleared visit date for “${name}”`
            : `Set visit date for “${name}” to ${next}`,
        detail: { visitDate: patch.visitDate },
      });
    }
  }

  if (
    "listPhase" in patch &&
    typeof patch.listPhase === "string" &&
    patch.listPhase !== before.listPhase
  ) {
    lines.push({
      action: "update",
      summary: `Moved “${name}” to ${phaseLabel(patch.listPhase as ListPhaseId)}`,
      detail: { from: before.listPhase, to: patch.listPhase },
    });
  }

  if (
    "applicationStatus" in patch &&
    typeof patch.applicationStatus === "string" &&
    patch.applicationStatus !== before.applicationStatus
  ) {
    const next = statusLabel(patch.applicationStatus as ApplicationStatus) || "Not started";
    lines.push({
      action: "update",
      summary: `Set application status for “${name}” to ${next}`,
      detail: { applicationStatus: patch.applicationStatus },
    });
  }

  if (
    "admissionTrack" in patch &&
    typeof patch.admissionTrack === "string" &&
    patch.admissionTrack !== before.admissionTrack
  ) {
    const next = trackLabel(patch.admissionTrack as AdmissionTrack) || "Not chosen";
    lines.push({
      action: "update",
      summary: `Set admission track for “${name}” to ${next}`,
      detail: { admissionTrack: patch.admissionTrack },
    });
  }

  if ("choice" in patch && typeof patch.choice === "string" && patch.choice !== before.choice) {
    lines.push({
      action: "update",
      summary: `Set list choice for “${name}” to ${patch.choice}`,
      detail: { choice: patch.choice },
    });
  }

  if (
    Array.isArray(patch.projectNotes) &&
    patch.projectNotes.length !== before.projectNotes.length
  ) {
    const beforeIds = new Set(before.projectNotes.map((note) => note.id));
    const afterIds = new Set(
      patch.projectNotes
        .filter((row): row is { id?: unknown } => Boolean(row) && typeof row === "object")
        .map((row) => (typeof row.id === "string" ? row.id : ""))
        .filter(Boolean),
    );
    const added = [...afterIds].filter((id) => !beforeIds.has(id)).length;
    const removed = [...beforeIds].filter((id) => !afterIds.has(id)).length;
    if (added > 0) {
      lines.push({
        action: "create",
        summary:
          added === 1
            ? `Sent a Project Management note from “${name}”`
            : `Sent ${added} Project Management notes from “${name}”`,
      });
    }
    if (removed > 0) {
      lines.push({
        action: "delete",
        summary:
          removed === 1
            ? `Removed a Project Management note on “${name}”`
            : `Removed ${removed} Project Management notes on “${name}”`,
      });
    }
  }

  return lines;
}

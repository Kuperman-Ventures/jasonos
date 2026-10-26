import type {
  DeckSummary,
  HeldMeetingRow,
  ReviewGoalMark,
  ReviewSlideMark,
} from "@/lib/server-actions/decks";
import type { StatusRung } from "@/components/jasonos/brand/status";

const TZ = "America/New_York";

export function formatMeetingWhen(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatMeetingDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatMeetingTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function homeDeckState(deck: DeckSummary): string {
  if (deck.reviewedAt) return "Reviewed";
  if (deck.hasTranscript) return "Transcript";
  if (deck.runStartedAt) return "Run";
  return "Draft";
}

export function activeDeckState(deck: DeckSummary): string {
  if (deck.hasTranscript) return "Transcript";
  if (deck.runStartedAt) return "Run";
  return "Draft";
}

export function heldDeckState(deck: DeckSummary): string {
  if (deck.reviewedAt) return "Reviewed";
  if (deck.hasTranscript) return "Transcript";
  return "No transcript";
}

export function heldMeetingState(row: HeldMeetingRow): string {
  if (row.reviewedAt) return "Reviewed";
  if (row.hasTranscript) return "Transcript attached";
  return "No transcript";
}

export function heldMeetingSubline(row: HeldMeetingRow): string {
  const when = `${formatMeetingDate(row.startsAt)}, ${formatMeetingTime(row.startsAt)}`;
  const attendees =
    row.attendeeNames.length > 0 ? row.attendeeNames.join(", ") : "No attendees listed";
  return `${when} · ${attendees}`;
}

export function goalMarkRung(mark: ReviewGoalMark): StatusRung {
  if (mark === "hit") return "done";
  if (mark === "partly") return 2;
  return 1;
}

export function goalMarkLabel(mark: ReviewGoalMark): string {
  if (mark === "hit") return "Hit";
  if (mark === "partly") return "Partly";
  return "Missed";
}

export function slideMarkRung(mark: ReviewSlideMark): StatusRung {
  if (mark === "covered") return "done";
  if (mark === "partly") return 2;
  return 1;
}

export function slideMarkLabel(mark: ReviewSlideMark): string {
  if (mark === "covered") return "Covered";
  if (mark === "partly") return "Partly";
  return "Skipped";
}

export function formatRunSummary(
  runStartedAt: string | null,
  runEndedAt: string | null
): string | null {
  if (!runStartedAt) return null;
  const date = formatMeetingDate(runStartedAt);
  if (!runEndedAt) return `Run ${date}`;
  const seconds = (Date.parse(runEndedAt) - Date.parse(runStartedAt)) / 1000;
  const mins = Math.max(0, Math.round(seconds / 60));
  const duration = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `Run ${date}, ${duration}`;
}

export function formatReviewedAt(iso: string, source: "granola" | "wispr" | null): string {
  const when = new Date(iso).toLocaleString("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const src = source === "granola" ? "Granola" : source === "wispr" ? "Wispr" : "stored";
  return `Reviewed ${when} from ${src} transcript.`;
}

export function activeDeckSubline(
  deck: DeckSummary,
  meetingTitle: string | null,
  meetingStartsAt: string | null
): string {
  const state = activeDeckState(deck);
  const meta = `${deck.slideCount} slides · ${state}`;

  if (!meetingTitle && !meetingStartsAt) {
    return `No meeting · ${meta}`;
  }

  if (meetingTitle && meetingTitle !== deck.name) {
    const when = meetingStartsAt ? formatMeetingWhen(meetingStartsAt) : "";
    return [meetingTitle, when, meta].filter(Boolean).join(" · ");
  }

  if (meetingStartsAt) {
    return `${formatMeetingDate(meetingStartsAt)}, ${formatMeetingTime(meetingStartsAt)} · ${meta}`;
  }

  return `No meeting · ${meta}`;
}

export function heldDeckSubline(
  deck: DeckSummary,
  meetingTitle: string | null,
  meetingStartsAt: string | null
): string {
  if (meetingTitle && meetingStartsAt) {
    return `${meetingTitle} · ${formatMeetingDate(meetingStartsAt)}, ${formatMeetingTime(meetingStartsAt)}`;
  }
  if (meetingTitle) return meetingTitle;
  if (deck.runEndedAt) {
    return formatMeetingWhen(deck.runEndedAt);
  }
  return "Not run in Live";
}

export function formatRubricAverage(average: number | null): string | null {
  if (average == null || !Number.isFinite(average)) return null;
  return `${average} / 5`;
}

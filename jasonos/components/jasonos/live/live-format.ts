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

/** Meetings from now through the next `days` days (default 7). */
export function filterUpcomingWeekMeetings<T extends { startsAt: string }>(
  meetings: T[],
  days = 7,
  nowMs = Date.now()
): T[] {
  const end = nowMs + days * 86_400_000;
  return meetings
    .filter((meeting) => {
      const ms = Date.parse(meeting.startsAt);
      return Number.isFinite(ms) && ms >= nowMs && ms <= end;
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

/** Compact attendee line so long invites don't blow out list rows. */
export function formatAttendeeLine(names: string[], maxShown = 2): string {
  const cleaned = names.map((name) => name.trim()).filter(Boolean);
  if (!cleaned.length) return "No attendees listed";
  if (cleaned.length <= maxShown) return cleaned.join(", ");
  return `${cleaned.slice(0, maxShown).join(", ")} +${cleaned.length - maxShown}`;
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

export type LiveListState =
  | "draft"
  | "held"
  | "needs_transcript"
  | "needs_review"
  | "reviewed"
  | "no_deck";

export function liveListStateLabel(state: LiveListState): string {
  switch (state) {
    case "draft":
      return "Draft";
    case "held":
      return "Held";
    case "needs_transcript":
      return "Needs Transcript";
    case "needs_review":
      return "Needs Review";
    case "reviewed":
      return "Reviewed";
    case "no_deck":
      return "No Deck Needed";
  }
}

/** Deck/meeting progress for Live Start lists. */
export function liveListState(input: {
  reviewedAt?: string | null;
  hasTranscript?: boolean;
  runEndedAt?: string | null;
  runStartedAt?: string | null;
  meetingStartsAt?: string | null;
  noDeck?: boolean;
  nowMs?: number;
}): LiveListState {
  if (input.noDeck) return "no_deck";
  if (input.reviewedAt) return "reviewed";
  if (input.hasTranscript) return "needs_review";
  // Ran in Live but no transcript yet — actionable.
  if (input.runEndedAt) return "needs_transcript";
  const startMs = input.meetingStartsAt ? Date.parse(input.meetingStartsAt) : NaN;
  const now = input.nowMs ?? Date.now();
  // Meeting already happened (or a run started) without transcript work.
  if ((Number.isFinite(startMs) && startMs < now) || input.runStartedAt) return "held";
  return "draft";
}

export function homeDeckState(deck: DeckSummary, meetingStartsAt?: string | null): string {
  return liveListStateLabel(
    liveListState({
      reviewedAt: deck.reviewedAt,
      hasTranscript: deck.hasTranscript,
      runEndedAt: deck.runEndedAt,
      runStartedAt: deck.runStartedAt,
      meetingStartsAt,
    })
  );
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

export function heldMeetingListState(row: HeldMeetingRow): LiveListState {
  return liveListState({
    reviewedAt: row.reviewedAt,
    hasTranscript: row.hasTranscript,
    // Held meetings without a Live run still need a transcript when past.
    runEndedAt: row.runInLive || !row.hasTranscript ? row.startsAt : null,
    meetingStartsAt: row.startsAt,
  });
}

export function heldMeetingState(row: HeldMeetingRow): string {
  return liveListStateLabel(heldMeetingListState(row));
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

export function formatReviewedAt(
  iso: string,
  source: "granola" | "wispr" | "paste" | null
): string {
  const when = new Date(iso).toLocaleString("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const src =
    source === "granola"
      ? "Granola"
      : source === "wispr"
        ? "Wispr"
        : source === "paste"
          ? "pasted"
          : "stored";
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

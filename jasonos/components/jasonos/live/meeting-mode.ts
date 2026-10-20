import type { MeetingPrepDetail } from "@/lib/server-actions/meeting-prep";
import type { MeetingReview } from "@/lib/server-actions/meeting-reviews";

export type MeetingPageMode = "before" | "after";

const STORAGE_PREFIX = "jasonos.live.meeting-mode.";

/** Derived mode: after once the call ended, has an outcome/review, or end time passed with a transcript. */
export function deriveMeetingMode(
  prep: MeetingPrepDetail,
  review: MeetingReview | null,
  nowMs = 0,
  hasTranscript = false
): MeetingPageMode {
  if (prep.outcomeMark || prep.liveEndedAt || review) return "after";
  const ended = nowMs > 0 && Date.parse(prep.endsAt) < nowMs;
  if (ended && hasTranscript) return "after";
  return "before";
}

export function readModeOverride(prepId: string): MeetingPageMode | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${prepId}`);
    if (stored === "before" || stored === "after") return stored;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeModeOverride(prepId: string, mode: MeetingPageMode | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!mode) {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${prepId}`);
      return;
    }
    window.localStorage.setItem(`${STORAGE_PREFIX}${prepId}`, mode);
  } catch {
    /* ignore */
  }
}

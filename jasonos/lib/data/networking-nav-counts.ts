import "server-only";

import { getNewCandidateCount } from "@/lib/server-actions/contact-candidates";
import { getOpenMeetingFollowupCount } from "@/lib/server-actions/meeting-followups";
import { getNewSentFollowupCount } from "@/lib/server-actions/sent-followups";

/** Badge numbers for Networking nav (top bar, dropdown, and outreach tabs). */
export type NetworkingNavCounts = {
  suggested: number;
  /** Meeting follow-ups + sent-mail follow-ups (same as Follow Up tab). */
  followUp: number;
};

export async function getNetworkingNavCounts(): Promise<NetworkingNavCounts> {
  const [suggested, meeting, sent] = await Promise.all([
    getNewCandidateCount(),
    getOpenMeetingFollowupCount(),
    getNewSentFollowupCount(),
  ]);
  return {
    suggested,
    followUp: meeting + sent,
  };
}

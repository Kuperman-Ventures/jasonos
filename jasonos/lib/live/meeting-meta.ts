import { getMeetingPrep } from "@/lib/server-actions/meeting-prep";
import type { AttachableMeeting } from "@/lib/server-actions/decks";

export type MeetingMeta = { title: string; startsAt: string };

export function meetingMapFromAttachable(meetings: AttachableMeeting[]): Map<string, MeetingMeta> {
  const map = new Map<string, MeetingMeta>();
  for (const meeting of meetings) {
    map.set(meeting.id, { title: meeting.title, startsAt: meeting.startsAt });
  }
  return map;
}

export async function enrichMeetingMap(
  map: Map<string, MeetingMeta>,
  prepIds: Array<string | null | undefined>
): Promise<Map<string, MeetingMeta>> {
  const missing = [...new Set(prepIds.filter((id): id is string => Boolean(id && !map.has(id))))];
  await Promise.all(
    missing.map(async (id) => {
      const result = await getMeetingPrep(id);
      if (result.ok) {
        map.set(id, { title: result.prep.title, startsAt: result.prep.startsAt });
      }
    })
  );
  return map;
}

export function deckMeetingFields(
  deck: { meetingPrepId: string | null },
  map: Map<string, MeetingMeta>
): { meetingTitle: string | null; meetingStartsAt: string | null } {
  if (!deck.meetingPrepId) {
    return { meetingTitle: null, meetingStartsAt: null };
  }
  const meta = map.get(deck.meetingPrepId);
  return {
    meetingTitle: meta?.title ?? null,
    meetingStartsAt: meta?.startsAt ?? null,
  };
}

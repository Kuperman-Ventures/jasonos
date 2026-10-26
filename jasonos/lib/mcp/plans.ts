import { getUpcomingMeetingPreps } from "@/lib/server-actions/meeting-prep";
import { createServiceRoleClient } from "@/lib/supabase/server";

async function deckIdByPrepId(prepIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!prepIds.length) return map;
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("decks")
      .select("id, meeting_prep_id")
      .eq("kind", "deck")
      .in("meeting_prep_id", prepIds);
    if (error) return map;
    for (const row of data ?? []) {
      const prepId = row.meeting_prep_id as string | null;
      const deckId = row.id as string | null;
      if (prepId && deckId) map.set(prepId, deckId);
    }
  } catch {
    // decks table may not exist until migration 0114 is applied
  }
  return map;
}

export async function listUpcomingMeetingPreps(input: { days?: number } = {}) {
  const days = Math.min(30, Math.max(1, input.days ?? 7));
  const result = await getUpcomingMeetingPreps(days);
  if (!result.ok) throw new Error(result.error);

  const decksByPrep = await deckIdByPrepId(result.meetings.map((meeting) => meeting.id));

  return {
    ok: true,
    days,
    meetings: result.meetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      starts_at: meeting.startsAt,
      ends_at: meeting.endsAt,
      attendees: meeting.attendees.map((person) => ({
        contact_id: person.contactId,
        name: person.name,
        email: person.email,
      })),
      deck_id: decksByPrep.get(meeting.id) ?? null,
    })),
  };
}

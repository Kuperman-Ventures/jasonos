// A call is booked when this person shows up on the calendar.
// Their email on the invite is the match. Their full name in the title
// is the backup, for events Jason typed in himself.

import { canonicalEmail } from "@/lib/outreach/contact-lookup";

export type CalendarGuestEvent = {
  id?: string;
  summary?: string;
  start?: string;
  end?: string;
  status?: string;
  attendees?: { email?: string; responseStatus?: string; self?: boolean }[];
};

export type BookedCall = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
};

export function findBookedCall(
  events: CalendarGuestEvent[],
  contact: { email?: string | null; name?: string | null },
  now: Date = new Date(),
  includePast = false
): BookedCall | null {
  const want = contact.email ? canonicalEmail(contact.email) : "";
  const name = (contact.name ?? "").trim().toLowerCase();
  const candidates: BookedCall[] = [];

  for (const event of events) {
    if (!event.id || !event.start) continue;
    if (event.status === "cancelled") continue;
    const starts = Date.parse(event.start);
    if (!Number.isFinite(starts)) continue;
    if (!includePast && starts < now.getTime() - 12 * 60 * 60 * 1000) continue;

    const guestHit = (event.attendees ?? []).some((guest) => {
      if (!guest.email || guest.self) return false;
      if (guest.responseStatus === "declined") return false;
      return want !== "" && canonicalEmail(guest.email) === want;
    });
    const title = event.summary ?? "";
    const nameHit =
      name.length > 3 && title.toLowerCase().includes(name);
    if (!guestHit && !nameHit) continue;

    candidates.push({
      id: event.id,
      title: title || "Networking call",
      startsAt: new Date(starts).toISOString(),
      endsAt: event.end ? new Date(event.end).toISOString() : null,
    });
  }

  candidates.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  return candidates[0] ?? null;
}

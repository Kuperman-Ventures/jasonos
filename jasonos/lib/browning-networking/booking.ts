// A call is booked when this person shows up on the calendar.
// Their email on the invite is the match. Their name in the title
// is the backup, for events Jason typed in himself — including
// short titles like "Matt/Jason Connect".

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

export function titleMatchesContactName(title: string, name: string): boolean {
  const n = name.trim().toLowerCase();
  const t = title.trim().toLowerCase();
  if (!n || !t) return false;
  if (n.length > 3 && t.includes(n)) return true;

  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  if (first.length < 3 || last.length < 3) return false;

  if (hasNameToken(t, last) && hasNameToken(t, first)) return true;

  // "Matt/Jason Connect", "Matt & Jason", "Jason <> Matt"
  return new RegExp(
    `(?:^|[\\s<(])${escapeRegExp(first)}(?:\\s*[\\/&]|\\s*<\\s*>\\s*|\\s+and\\s+)`,
    "i"
  ).test(title);
}

function hasNameToken(haystack: string, token: string): boolean {
  return new RegExp(`(?:^|[^a-z])${escapeRegExp(token)}(?:[^a-z]|$)`, "i").test(
    haystack
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findBookedCall(
  events: CalendarGuestEvent[],
  contact: { email?: string | null; name?: string | null; emails?: string[] | null },
  now: Date = new Date(),
  includePast = false
): BookedCall | null {
  const wants = new Set<string>();
  for (const raw of [contact.email, ...(contact.emails ?? [])]) {
    const email = (raw ?? "").trim();
    if (email.includes("@")) wants.add(canonicalEmail(email));
  }
  const name = (contact.name ?? "").trim();
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
      return wants.has(canonicalEmail(guest.email));
    });
    const title = event.summary ?? "";
    const nameHit = name.length > 3 && titleMatchesContactName(title, name);
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

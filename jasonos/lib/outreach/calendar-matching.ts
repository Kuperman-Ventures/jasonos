// Pure calendar → contact matching. Used by Sync and upcoming-meeting reads.
// Keep this file free of `server-only` so unit tests can import it.

import {
  looksLikePersonName,
  normalizeName,
  type ContactLookup,
  type ContactLookupRow,
} from "./contact-lookup";

export type CalendarGuest = { email: string; name?: string };

export type CalendarContactMatch = {
  contact: ContactLookupRow;
  email: string | null;
  name: string | null;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Email first, then the guest display name (events that hide the address). */
export function resolveCalendarGuest(
  lookup: ContactLookup,
  guest: CalendarGuest
): ContactLookupRow | undefined {
  if (guest.email && guest.email.includes("@")) {
    const header = guest.name ? `${guest.name} <${guest.email}>` : guest.email;
    const hit = lookup.resolve(header);
    if (hit) return hit;
  }
  return lookup.resolvePeer({
    name: guest.name ?? null,
    email: guest.email || null,
  });
}

/**
 * Attach a meeting when the title contains a contact's first + last name.
 * Skips single-token names so "David" in "David / team standup" does not match.
 */
export function contactsNamedInTitle(
  title: string | null | undefined,
  lookup: ContactLookup
): ContactLookupRow[] {
  const hay = normalizeName(title ?? "");
  if (!hay) return [];
  const hits: ContactLookupRow[] = [];
  for (const row of lookup.rows) {
    const name = normalizeName(row.name);
    if (!name || name.split(" ").filter(Boolean).length < 2) continue;
    if (!looksLikePersonName(row.name)) continue;
    const re = new RegExp(`(?:^|\\s)${escapeRegExp(name)}(?:\\s|$)`);
    if (re.test(hay)) hits.push(row);
  }
  return hits;
}

export function matchCalendarEventToContacts(opts: {
  title?: string | null;
  guests: CalendarGuest[];
  lookup: ContactLookup;
}): { matches: CalendarContactMatch[]; unmatchedGuests: CalendarGuest[] } {
  const seen = new Set<string>();
  const matches: CalendarContactMatch[] = [];
  const unmatchedGuests: CalendarGuest[] = [];

  const add = (
    contact: ContactLookupRow,
    email: string | null,
    name: string | null
  ) => {
    if (seen.has(contact.id)) return;
    seen.add(contact.id);
    matches.push({ contact, email, name });
  };

  for (const guest of opts.guests) {
    const contact = resolveCalendarGuest(opts.lookup, guest);
    if (!contact) {
      unmatchedGuests.push(guest);
      continue;
    }
    add(
      contact,
      guest.email?.includes("@") ? guest.email : null,
      guest.name ?? null
    );
  }

  for (const contact of contactsNamedInTitle(opts.title, opts.lookup)) {
    add(contact, null, contact.name);
  }

  return { matches, unmatchedGuests };
}

// Pure contact matching — no DB. Used by Gmail/Calendar sync and Suggested
// Contacts. Keep this file free of `server-only` so unit tests can import it.

/** Keep in sync with OUTLOOK_WRAP_EMAIL in unwrap-forwarded-mail.ts. */
const OUTLOOK_WRAP_EMAIL = "jason.kuperman@outlook.com";

/** Known outbound email addresses (v1 hardcode — keep in sync if these change). */
export const MY_EMAILS = [
  "jason@kupermanadvisors.com",
  "jskuperman@gmail.com",
  OUTLOOK_WRAP_EMAIL,
];

/** Extract the bare email from a header like `"Name" <email@x.com>`. */
export function extractEmail(value: string): string {
  const m = value.match(/<([^>]+)>/);
  return (m?.[1] ?? value).trim().toLowerCase();
}

/** Strip plus-addressing so `jason+jobs@…` canonicalises to `jason@…`. */
export function canonicalEmail(raw: string): string {
  const e = extractEmail(raw);
  return e.replace(/\+[^@]*@/, "@");
}

/** True when `candidateEmail` is already on a contact, ignoring case / plus-tags. */
export function hasExactEmailMatch(
  candidateEmail: string,
  contactEmails: readonly string[]
): boolean {
  const want = canonicalEmail(candidateEmail);
  if (!want.includes("@")) return false;
  return contactEmails.some((e) => e && canonicalEmail(e) === want);
}

/** Returns the display name part of a "Name <email>" header, lower-cased. */
export function extractDisplayName(value: string): string {
  const m = value.match(/^([^<]+)<[^>]+>/);
  return (m?.[1] ?? "").trim().replace(/^"|"$/g, "").toLowerCase();
}

export function normalizeName(name: string): string {
  // Strip apostrophes/punctuation so "Rena O'Brien" matches "Rena OBrien"
  // (common calendar vs CRM spelling drift).
  return name
    .toLowerCase()
    .replace(/['’ʼ]/g, "")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isFromMe(fromHeader: string): boolean {
  const lower = fromHeader.toLowerCase();
  return MY_EMAILS.some((e) => lower.includes(e));
}

export function isMyOwnAddress(addr: string): boolean {
  const canon = canonicalEmail(addr);
  return MY_EMAILS.some((me) => canonicalEmail(me) === canon);
}

export interface ContactLookupRow {
  id: string;
  name: string;
  emails: string[];
  phone: string | null;
}

export interface ContactLookup {
  rows: ContactLookupRow[];
  byEmail: Map<string, ContactLookupRow>;
  byName: Map<string, ContactLookupRow>;
  byPhone: Map<string, ContactLookupRow>;
  /** Resolve a "Name <email>" header to a contact row, or undefined. */
  resolve(header: string): ContactLookupRow | undefined;
  /**
   * Exact email match only (canonicalised). Used by Suggested Contacts so a
   * person already in People with that address is never re-suggested.
   */
  resolveEmail(email: string): ContactLookupRow | undefined;
  /** Resolve a Beeper/chat peer by phone, email, or display name. */
  resolvePeer(peer: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  }): ContactLookupRow | undefined;
}

/** Digits-only phone key; US numbers collapse to last 10 digits. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

function asEmailList(emails: unknown): string[] {
  if (!Array.isArray(emails)) return [];
  return emails.filter((e): e is string => typeof e === "string" && Boolean(e.trim()));
}

export function emptyLookup(): ContactLookup {
  return {
    rows: [],
    byEmail: new Map(),
    byName: new Map(),
    byPhone: new Map(),
    resolve: () => undefined,
    resolveEmail: () => undefined,
    resolvePeer: () => undefined,
  };
}

/**
 * Build an in-memory contact index. Suggested Contacts must call
 * `resolveEmail` (exact address) rather than relying only on `resolve`,
 * which also matches by display name.
 */
export function createContactLookup(rows: ContactLookupRow[]): ContactLookup {
  const byEmail = new Map<string, ContactLookupRow>();
  const byName = new Map<string, ContactLookupRow>();
  const byPhone = new Map<string, ContactLookupRow>();

  const normalized: ContactLookupRow[] = rows.map((row) => ({
    ...row,
    emails: asEmailList(row.emails),
  }));

  for (const row of normalized) {
    for (const email of row.emails) {
      byEmail.set(canonicalEmail(email), row);
    }
    byName.set(normalizeName(row.name), row);
    const phoneKey = normalizePhone(row.phone);
    if (phoneKey) byPhone.set(phoneKey, row);
  }

  return {
    rows: normalized,
    byEmail,
    byName,
    byPhone,
    resolveEmail(email: string) {
      const e = extractEmail(email);
      if (!e || !e.includes("@")) return undefined;
      return byEmail.get(canonicalEmail(e));
    },
    resolve(header: string) {
      const email = extractEmail(header);
      if (!email) return undefined;
      if (isMyOwnAddress(email)) return undefined;

      // 1. Direct email match
      const byMail = byEmail.get(canonicalEmail(email));
      if (byMail) return byMail;

      // 2. Display name match
      const display = extractDisplayName(header);
      if (display) {
        const byDisp = byName.get(display);
        if (byDisp) return byDisp;
      }

      // 3. Derive name from local-part: "jane.doe@…" → "jane doe"
      const local = email.split("@")[0] ?? "";
      const guessed = local
        .replace(/[._\-+]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (guessed) return byName.get(guessed);

      return undefined;
    },
    resolvePeer(peer) {
      const phoneKey = normalizePhone(peer.phone);
      if (phoneKey) {
        const hit = byPhone.get(phoneKey);
        if (hit) return hit;
      }
      if (peer.email) {
        const email = extractEmail(peer.email);
        if (email && !isMyOwnAddress(email)) {
          const hit = byEmail.get(canonicalEmail(email));
          if (hit) return hit;
        }
      }
      if (peer.name) {
        const hit = byName.get(normalizeName(peer.name));
        if (hit) return hit;
      }
      return undefined;
    },
  };
}

/** True when this person should not appear in Suggested Contacts. */
export function isAlreadyAContact(
  candidate: { email: string; name?: string | null },
  lookup: ContactLookup
): boolean {
  if (lookup.resolveEmail(candidate.email)) return true;
  const header = candidate.name
    ? `${candidate.name} <${candidate.email}>`
    : candidate.email;
  return Boolean(lookup.resolve(header));
}

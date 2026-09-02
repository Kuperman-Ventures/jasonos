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

/** Synthetic address for Beeper peers who have a name/phone but no email. */
export const BEEPER_PLACEHOLDER_DOMAIN = "beeper.invalid";

export function isBeeperPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return extractEmail(email).endsWith(`@${BEEPER_PLACEHOLDER_DOMAIN}`);
}

/** Prefer a real person name over a phone or handle when Beeper sends both. */
export function preferPersonName(
  ...candidates: Array<string | null | undefined>
): string | null {
  const trimmed = candidates
    .map((value) => (value ?? "").trim())
    .filter(Boolean);
  return trimmed.find((value) => looksLikePersonName(value)) ?? trimmed[0] ?? null;
}

/** First name, or first + last. Rejects phones, handles, and bare IDs. */
export function looksLikePersonName(raw: string | null | undefined): boolean {
  const name = (raw ?? "").trim();
  if (!name) return false;
  if (/^\+?[\d\s().-]{7,}$/.test(name)) return false;
  const tokens = name.split(/\s+/).filter(Boolean);
  if (!tokens.length || tokens.length > 5) return false;
  const letterTokens = tokens.filter((t) => /[a-zA-Z]{2,}/.test(t));
  if (!letterTokens.length) return false;
  if (tokens.length === 1 && /\d/.test(tokens[0] ?? "")) return false;
  return true;
}

export type BeeperCandidateIdentity = {
  /** Unique Suggested key. Real email if we have one, else a name-based placeholder. */
  email: string;
  name: string;
  phone: string | null;
  realEmail: string | null;
};

/** Name is the record. Phone/email are extras. No name → skip. */
export function beeperCandidateIdentity(peer: {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  chatTitle?: string | null;
}): BeeperCandidateIdentity | null {
  const fromName = looksLikePersonName(peer.name) ? peer.name!.trim() : "";
  const fromTitle = looksLikePersonName(peer.chatTitle)
    ? peer.chatTitle!.trim()
    : "";
  const name = fromName || fromTitle;
  if (!name) return null;

  let realEmail: string | null = null;
  if (peer.email) {
    const email = extractEmail(peer.email);
    if (
      email.includes("@") &&
      !isMyOwnAddress(email) &&
      !isBeeperPlaceholderEmail(email)
    ) {
      realEmail = canonicalEmail(email);
    }
  }

  return {
    email:
      realEmail ??
      `${normalizeName(name).replace(/\s+/g, ".")}@${BEEPER_PLACEHOLDER_DOMAIN}`,
    name,
    phone: normalizePhone(peer.phone),
    realEmail,
  };
}

/** @deprecated use beeperCandidateIdentity — kept for existing imports/tests. */
export function beeperSightingEmail(peer: {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  chatTitle?: string | null;
  chatId?: string | null;
}): string | null {
  return beeperCandidateIdentity(peer)?.email ?? null;
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

/** Hide from Suggested only when this exact email is already on a People row. */
export function isAlreadyAContact(
  candidate: { email: string; name?: string | null },
  lookup: ContactLookup
): boolean {
  return Boolean(lookup.resolveEmail(candidate.email));
}

export interface SuggestedNameMatch {
  id: string;
  name: string;
  /** Exact normalized name vs close spelling (Dellaire / Dallaire). */
  kind: "exact" | "close";
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (curr[j - 1] ?? 0) + 1,
        (prev[j] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost
      );
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j] ?? 0;
  }
  return prev[b.length] ?? 0;
}

/** First+last close enough to offer a merge, not auto-collapse. */
export function namesLookLikeSamePerson(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = na.split(" ").filter(Boolean);
  const tb = nb.split(" ").filter(Boolean);
  if (ta.length < 2 || tb.length < 2) return false;
  const firstA = ta[0] ?? "";
  const firstB = tb[0] ?? "";
  const lastA = ta[ta.length - 1] ?? "";
  const lastB = tb[tb.length - 1] ?? "";
  if (levenshtein(firstA, firstB) > 2) return false;
  const lastDist = levenshtein(lastA, lastB);
  if (lastA === lastB) return true;
  // Tight on last-name typos so "Chris Hall" ≠ "Chris Hill".
  return lastDist <= 1 && Math.min(lastA.length, lastB.length) >= 6;
}

/**
 * Name-only match for Suggested → Merge. Skips when the email is already
 * on file (those rows are hidden, not merged).
 */
export function findNameMatch(
  candidate: { email: string; name?: string | null },
  lookup: ContactLookup
): SuggestedNameMatch | null {
  if (lookup.resolveEmail(candidate.email)) return null;

  const names: string[] = [];
  if (candidate.name?.trim()) names.push(candidate.name.trim());
  const local = extractEmail(candidate.email).split("@")[0] ?? "";
  const guessed = local
    .replace(/[._\-+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (guessed) names.push(guessed);

  for (const n of names) {
    const hit = lookup.byName.get(normalizeName(n));
    if (hit) return { id: hit.id, name: hit.name, kind: "exact" };
  }

  if (candidate.name?.trim()) {
    for (const row of lookup.rows) {
      if (namesLookLikeSamePerson(candidate.name, row.name)) {
        return { id: row.id, name: row.name, kind: "close" };
      }
    }
  }
  return null;
}

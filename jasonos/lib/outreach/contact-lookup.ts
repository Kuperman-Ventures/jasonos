// Pure contact matching — no DB. Used by Gmail/Calendar sync and Suggested
// Contacts. Keep this file free of `server-only` so unit tests can import it.

/** Keep in sync with OUTLOOK_WRAP_EMAIL in unwrap-forwarded-mail.ts. */
const OUTLOOK_WRAP_EMAIL = "jason.kuperman@outlook.com";

/** Known outbound email addresses (v1 hardcode — keep in sync if these change). */
export const MY_EMAILS = [
  "jason@kupermanadvisors.com",
  "jasonkuperman@gmail.com",
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
  /** Firm name from People, when we have it. Used to merge nameless emails. */
  company?: string | null;
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

/** True when a People-card "phone" is actually an email (common CRM import mess). */
export function looksLikeEmail(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const value = raw.trim();
  if (!value.includes("@")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Digits-only phone key; US numbers collapse to last 10 digits.
 * Rejects emails and short digit crumbs (e.g. "2002" from don@…2002@yahoo.com)
 * so Beeper matching doesn't treat junk as a real number.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (looksLikeEmail(raw)) return null;
  const digits = raw.replace(/\D+/g, "");
  if (digits.length < 7) return null;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

/** Phone field is usable for Beeper / SMS matching (not blank, not an email). */
export function isUsablePhone(raw: string | null | undefined): boolean {
  return Boolean(normalizePhone(raw));
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
    company: row.company ?? null,
  }));

  for (const row of normalized) {
    for (const email of row.emails) {
      byEmail.set(canonicalEmail(email), row);
    }
    // Rescue emails that were pasted into the phone field (Don McKinney).
    if (looksLikeEmail(row.phone)) {
      byEmail.set(canonicalEmail(row.phone!), row);
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

/**
 * Nickname → canonical first name. Mike vs Michael is the common miss
 * (Levenshtein is 4, so the typo check never catches it).
 */
const FIRST_NAME_CANON: Record<string, string> = {
  mike: "michael",
  mikey: "michael",
  bob: "robert",
  rob: "robert",
  bobby: "robert",
  bill: "william",
  will: "william",
  billy: "william",
  jim: "james",
  jimmy: "james",
  joe: "joseph",
  tom: "thomas",
  tommy: "thomas",
  dan: "daniel",
  danny: "daniel",
  dave: "david",
  chris: "christopher",
  matt: "matthew",
  nick: "nicholas",
  steve: "steven",
  liz: "elizabeth",
  beth: "elizabeth",
  kate: "katherine",
  kathy: "katherine",
  jen: "jennifer",
  alex: "alexander",
  tony: "anthony",
  rick: "richard",
  ben: "benjamin",
  sam: "samuel",
  jon: "jonathan",
};

function firstToken(name: string): string {
  return normalizeName(name).split(" ").filter(Boolean)[0] ?? "";
}

function canonicalFirstName(name: string): string {
  const first = firstToken(name);
  return FIRST_NAME_CANON[first] ?? first;
}

/** Mike/Michael, plus 1–2 letter typos on longer first names. */
export function firstNamesMatch(a: string, b: string): boolean {
  const fa = firstToken(a);
  const fb = firstToken(b);
  if (!fa || !fb) return false;
  if (fa === fb) return true;
  if (canonicalFirstName(fa) === canonicalFirstName(fb)) return true;
  return Math.min(fa.length, fb.length) >= 4 && levenshtein(fa, fb) <= 2;
}

const PERSONAL_EMAIL_LABELS = new Set([
  "gmail",
  "googlemail",
  "yahoo",
  "hotmail",
  "outlook",
  "icloud",
  "aol",
  "me",
  "proton",
  "protonmail",
  "msn",
  "live",
]);

/** "AC Lions (+)" → "aclions". "aclion.com" → "aclion". */
export function compactCompanyLabel(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function emailDomainCompanyKey(email: string): string | null {
  const domain = extractEmail(email).split("@")[1] ?? "";
  const parts = domain.toLowerCase().split(".").filter(Boolean);
  if (parts.length < 2) return null;
  const last = parts[parts.length - 1] ?? "";
  const label =
    parts.length >= 3 && last.length <= 2
      ? (parts[parts.length - 2] ?? "")
      : parts.slice(0, -1).join("");
  if (!label || label.length < 4) return null;
  if (PERSONAL_EMAIL_LABELS.has(parts[0] ?? "") || PERSONAL_EMAIL_LABELS.has(label)) {
    return null;
  }
  return label;
}

/** Aclion vs AC Lions (+): same stem, or one-letter firm typo. */
export function companiesLookRelated(a: string, b: string): boolean {
  const ca = compactCompanyLabel(a);
  const cb = compactCompanyLabel(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  if (ca.length >= 5 && cb.length >= 5) {
    if (ca.startsWith(cb) || cb.startsWith(ca)) return true;
    if (levenshtein(ca, cb) <= 1) return true;
  }
  return false;
}

function contactMatchesCompanyHint(row: ContactLookupRow, hint: string): boolean {
  if (row.company && companiesLookRelated(hint, row.company)) return true;
  for (const email of row.emails) {
    const key = emailDomainCompanyKey(email);
    if (key && companiesLookRelated(hint, key)) return true;
  }
  return false;
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
  const lastA = ta[ta.length - 1] ?? "";
  const lastB = tb[tb.length - 1] ?? "";
  if (!firstNamesMatch(ta[0] ?? "", tb[0] ?? "")) return false;
  const lastDist = levenshtein(lastA, lastB);
  if (lastA === lastB) return true;
  // Tight on last-name typos so "Chris Hall" ≠ "Chris Hill".
  return lastDist <= 1 && Math.min(lastA.length, lastB.length) >= 6;
}

/**
 * Name-only match for Suggested → Merge. Skips when the email is already
 * on file (those rows are hidden, not merged).
 *
 * Nameless emails (mike@aclion.com with a blank display name) can still
 * merge when the local-part first name plus firm/domain uniquely hit one
 * People row. Bare first name without a firm does not — too many Mikes.
 */
export function findNameMatch(
  candidate: { email: string; name?: string | null; company?: string | null },
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

  const first = firstToken(candidate.name ?? "") || firstToken(guessed);
  if (!first) return null;

  const hints: string[] = [];
  if (candidate.company?.trim()) hints.push(candidate.company.trim());
  const fromDomain = emailDomainCompanyKey(candidate.email);
  if (fromDomain) hints.push(fromDomain);
  if (!hints.length) return null;

  const hits = lookup.rows.filter((row) => {
    if (!firstNamesMatch(first, row.name)) return false;
    return hints.some((hint) => contactMatchesCompanyHint(row, hint));
  });
  if (hits.length !== 1) return null;
  const hit = hits[0]!;
  return { id: hit.id, name: hit.name, kind: "close" };
}

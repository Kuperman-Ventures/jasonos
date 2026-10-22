/** Email domains that do not identify an employer website. */

const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "yahoo.com",
  "ymail.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "mail.com",
  "gmx.com",
  "gmx.net",
  "fastmail.com",
  "hey.com",
  "zoho.com",
]);

/** Lowercased host from an email, or null when missing / malformed. */
export function emailDomain(email: string | null | undefined): string | null {
  const raw = (email ?? "").trim().toLowerCase();
  const at = raw.lastIndexOf("@");
  if (at < 0) return null;
  const host = raw.slice(at + 1).replace(/^\.+|\.+$/g, "");
  if (!host || !host.includes(".")) return null;
  return host;
}

export function isPersonalEmailDomain(domain: string | null | undefined): boolean {
  const host = (domain ?? "").trim().toLowerCase();
  if (!host) return false;
  if (PERSONAL_DOMAINS.has(host)) return true;
  // Subdomains of personal hosts are rare; treat exact match only.
  return false;
}

/**
 * Company website host from a work email.
 * Returns null for personal domains so research skips the scrape.
 */
export function companyDomainFromEmail(email: string | null | undefined): string | null {
  const host = emailDomain(email);
  if (!host || isPersonalEmailDomain(host)) return null;
  return host;
}

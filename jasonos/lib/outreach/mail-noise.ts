// Shared filters for Suggested-contact capture.
// Robots stay out. Real people — including calendar invite organizers — stay in.
// Jason reviews Suggested; this list is meant to be a bit noisy on purpose.

const AUTOMATED_LOCAL_RE =
  /^(no-?reply|noreply|do-?not-?reply|donotreply|mailer-daemon|postmaster|bounce[s]?|newsletter|mailer)([._+-]|$)/i;

const AUTOMATED_DOMAIN_RE =
  /(^|\.)(bounce|bounces|mailer|sendgrid|mailchimp|mcsv|substack|mailgun|amazonses|sparkpostmail|sendinblue|hubspotemail|mktomail)\./i;

const CALENDAR_PROXY_LOCALS = new Set([
  "calendar-notification",
  "calendar-server",
  "calendar-offers",
]);

export function isCalendarProxyAddress(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!e.includes("@")) return false;
  const [local, domain] = e.split("@");
  if (CALENDAR_PROXY_LOCALS.has(local ?? "")) return true;
  if (domain === "google.com" && (local ?? "").startsWith("calendar-")) return true;
  if (e.endsWith("@resource.calendar.google.com")) return true;
  if (e.includes("@group.calendar.google.com")) return true;
  return false;
}

export function isCalendarInviteSubject(subject?: string | null): boolean {
  return /^\s*(invitation|updated invitation|canceled event|cancelled event)\b/i.test(
    subject ?? ""
  );
}

export function isNoiseEmail(email: string): boolean {
  const [local, domain] = email.toLowerCase().split("@");
  if (!local || !domain) return true;
  if (isCalendarProxyAddress(email)) return true;
  if (AUTOMATED_LOCAL_RE.test(local)) return true;
  if (AUTOMATED_DOMAIN_RE.test(domain)) return true;
  return false;
}

export function companyFromEmail(email: string): string | null {
  const domain = email.split("@")[1] ?? "";
  const base = domain.split(".").slice(0, -1).join(".");
  const free = new Set([
    "gmail",
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
  if (!base || free.has(base.toLowerCase())) return null;
  return base
    .split(/[.-]/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

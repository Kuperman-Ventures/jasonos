/**
 * Google OAuth scopes JasonOS requests and requires for mail + calendar.
 * Keep in sync with /api/auth/google.
 */

export const GOOGLE_GMAIL_READONLY =
  "https://www.googleapis.com/auth/gmail.readonly";
export const GOOGLE_GMAIL_SEND = "https://www.googleapis.com/auth/gmail.send";
export const GOOGLE_CALENDAR_READONLY =
  "https://www.googleapis.com/auth/calendar.readonly";
export const GOOGLE_CALENDAR_EVENTS =
  "https://www.googleapis.com/auth/calendar.events";

/** Capability scopes (identity scopes like email/profile/openid are not listed). */
export const GOOGLE_REQUIRED_SCOPES = [
  GOOGLE_GMAIL_READONLY,
  GOOGLE_GMAIL_SEND,
  GOOGLE_CALENDAR_READONLY,
  GOOGLE_CALENDAR_EVENTS,
] as const;

export type GoogleRequiredScope = (typeof GOOGLE_REQUIRED_SCOPES)[number];

/** Full OAuth scope string for the consent screen. */
export const GOOGLE_OAUTH_SCOPE_PARAM = [
  ...GOOGLE_REQUIRED_SCOPES,
  "email",
  "profile",
].join(" ");

const SCOPE_LABELS: Record<GoogleRequiredScope, string> = {
  [GOOGLE_GMAIL_READONLY]: "Gmail read",
  [GOOGLE_GMAIL_SEND]: "Gmail send",
  [GOOGLE_CALENDAR_READONLY]: "Calendar read",
  [GOOGLE_CALENDAR_EVENTS]: "Calendar events",
};

export function normalizeOauthScopes(
  scopes: string[] | string | null | undefined
): string[] {
  if (!scopes) return [];
  const raw = Array.isArray(scopes) ? scopes : scopes.split(/[\s,]+/);
  const out = new Set<string>();
  for (const part of raw) {
    const s = part.trim();
    if (!s) continue;
    out.add(s);
    // Google sometimes returns short names; accept both forms.
    if (s === "gmail.readonly") out.add(GOOGLE_GMAIL_READONLY);
    if (s === "gmail.send") out.add(GOOGLE_GMAIL_SEND);
    if (s === "calendar.readonly") out.add(GOOGLE_CALENDAR_READONLY);
    if (s === "calendar.events") out.add(GOOGLE_CALENDAR_EVENTS);
  }
  return [...out];
}

export function missingGoogleScopes(
  granted: string[] | string | null | undefined
): GoogleRequiredScope[] {
  const have = new Set(normalizeOauthScopes(granted).map((s) => s.toLowerCase()));
  return GOOGLE_REQUIRED_SCOPES.filter((scope) => !have.has(scope.toLowerCase()));
}

export function googleScopeLabel(scope: string): string {
  return SCOPE_LABELS[scope as GoogleRequiredScope] ?? scope.replace(/^https:\/\/www\.googleapis\.com\/auth\//, "");
}

export function formatMissingGoogleScopes(missing: string[]): string {
  if (missing.length === 0) return "";
  return missing.map(googleScopeLabel).join(", ");
}

export function googleMissingScopesMessage(input: {
  accountEmail: string;
  accountLabel: "Advisors Google" | "Personal Gmail";
  missing: string[];
}): string | null {
  if (input.missing.length === 0) return null;
  const labels = formatMissingGoogleScopes(input.missing);
  return `${input.accountEmail}: missing ${labels}. Reconnect ${input.accountLabel} in Settings and allow all requested permissions.`;
}

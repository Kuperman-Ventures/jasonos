/**
 * Microsoft Graph scopes JasonOS requests for Outlook mail + calendar.
 * Keep in sync with MICROSOFT_OAUTH_SCOPES in outlook-tokens.
 */

export const OUTLOOK_MAIL_READ = "https://graph.microsoft.com/Mail.Read";
export const OUTLOOK_CALENDARS_READ =
  "https://graph.microsoft.com/Calendars.Read";
export const OUTLOOK_USER_READ = "https://graph.microsoft.com/User.Read";

export const OUTLOOK_REQUIRED_SCOPES = [
  OUTLOOK_MAIL_READ,
  OUTLOOK_CALENDARS_READ,
  OUTLOOK_USER_READ,
] as const;

export type OutlookRequiredScope = (typeof OUTLOOK_REQUIRED_SCOPES)[number];

const SCOPE_LABELS: Record<OutlookRequiredScope, string> = {
  [OUTLOOK_MAIL_READ]: "Mail read",
  [OUTLOOK_CALENDARS_READ]: "Calendar read",
  [OUTLOOK_USER_READ]: "User profile",
};

export function normalizeOutlookScopes(
  scopes: string[] | string | null | undefined
): string[] {
  if (!scopes) return [];
  const raw = Array.isArray(scopes) ? scopes : scopes.split(/[\s,]+/);
  const out = new Set<string>();
  for (const part of raw) {
    const s = part.trim();
    if (!s) continue;
    out.add(s);
    // Graph sometimes returns short names without the host prefix.
    if (s === "Mail.Read") out.add(OUTLOOK_MAIL_READ);
    if (s === "Calendars.Read") out.add(OUTLOOK_CALENDARS_READ);
    if (s === "User.Read") out.add(OUTLOOK_USER_READ);
  }
  return [...out];
}

export function missingOutlookScopes(
  granted: string[] | string | null | undefined
): OutlookRequiredScope[] {
  const have = new Set(
    normalizeOutlookScopes(granted).map((s) => s.toLowerCase())
  );
  return OUTLOOK_REQUIRED_SCOPES.filter(
    (scope) => !have.has(scope.toLowerCase())
  );
}

export function outlookScopeLabel(scope: string): string {
  return (
    SCOPE_LABELS[scope as OutlookRequiredScope] ??
    scope.replace(/^https:\/\/graph\.microsoft\.com\//, "")
  );
}

export function formatMissingOutlookScopes(missing: string[]): string {
  if (missing.length === 0) return "";
  return missing.map(outlookScopeLabel).join(", ");
}

export function outlookMissingScopesMessage(input: {
  accountEmail: string;
  missing: string[];
}): string | null {
  if (input.missing.length === 0) return null;
  const labels = formatMissingOutlookScopes(input.missing);
  return `${input.accountEmail}: missing ${labels}. Reconnect Outlook in Settings and allow all requested permissions.`;
}

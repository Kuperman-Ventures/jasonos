/** Jason's personal Gmail. Settings, sync hints, and Google sign-in all use this address. */
export const GMAIL_ACCOUNT_EMAIL = "jskuperman@gmail.com";

export const GMAIL_ACCOUNT_EMAIL_ALIASES = [GMAIL_ACCOUNT_EMAIL] as const;

export const ADVISORS_ACCOUNT_EMAIL = "jason@kupermanadvisors.com";

export function isPersonalGmailAccount(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  return (GMAIL_ACCOUNT_EMAIL_ALIASES as readonly string[]).includes(e);
}

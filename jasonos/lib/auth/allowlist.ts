/** Jason-only emails that may open the locked JasonOS app. College household accounts are not on this list. */

export const JASONOS_LOGIN_EMAILS = [
  "jason@kupermanadvisors.com",
  "jasonkuperman@gmail.com",
  "jskuperman@gmail.com",
  "jason.kuperman@outlook.com",
] as const;

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isJasonosEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return (JASONOS_LOGIN_EMAILS as readonly string[]).includes(normalized);
}

export function loginErrorMessage(code: string | null | undefined): string | null {
  switch (code) {
    case "auth_not_configured":
      return "Login is not fully configured on this deployment yet.";
    case "not_jason":
      return "This account cannot open JasonOS.";
    case "auth":
      return "Sign-in did not finish. Try again.";
    case "expired":
      return "Unlock again with Face ID or Touch ID.";
    case "passkey":
      return "Face ID / Touch ID did not complete. Try again, or use Google.";
    default:
      return null;
  }
}

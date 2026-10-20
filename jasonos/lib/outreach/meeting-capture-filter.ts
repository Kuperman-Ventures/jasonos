import { MY_EMAILS, canonicalEmail } from "@/lib/outreach/contact-lookup";

const HOLD_TITLE = /^hold\s*·/i;
const MY_EMAIL_SET = new Set(MY_EMAILS.map((email) => canonicalEmail(email)));

/** Tentative Browning holds and solitary self-holds never become meetings rows. */
export function shouldSkipCalendarMeeting(row: {
  title: string | null;
  guestEmails?: string[];
}): boolean {
  const title = (row.title ?? "").trim();
  if (HOLD_TITLE.test(title)) return true;
  const guests = (row.guestEmails ?? [])
    .map((email) => canonicalEmail(email))
    .filter(Boolean);
  if (!guests.length) return false;
  return guests.every((email) => MY_EMAIL_SET.has(email));
}

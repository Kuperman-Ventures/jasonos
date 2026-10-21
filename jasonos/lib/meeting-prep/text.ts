/** Calendar invite HTML → readable text. Keeps line breaks. */
export function plainTextFromHtml(input: string): string {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** First 300 characters of a calendar description, or null when empty / join junk. */
export function purposeFromCalendarDescription(
  description: string | null | undefined
): string | null {
  if (!description?.trim()) return null;
  const text = plainTextFromHtml(description).replace(/\s+/g, " ").trim();
  if (!text || isJoinBoilerplate(text)) return null;
  return text.slice(0, 300);
}

/**
 * Zoom / Teams / Meet / Calendly join text is not a meeting purpose.
 * Calendly often writes "Event Name… Zoom web conference… Password…"
 * without the classic "Join Zoom Meeting / Meeting ID / Passcode" lines.
 */
export function isJoinBoilerplate(value: string | null | undefined): boolean {
  const text = (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!text) return false;

  const markers = [
    "join zoom",
    "zoom meeting",
    "zoom web conference",
    "meeting id:",
    "passcode:",
    "password:",
    "teams.microsoft",
    "meet.google.com",
    "one tap mobile",
    "you can also dial in",
    "event name",
    "zoom.us/j/",
    "zoom.us/my/",
  ];
  const hits = markers.filter((marker) => text.includes(marker)).length;
  if (hits >= 2) return true;
  if (hits >= 1 && text.length < 120) return true;

  // A long body that is mostly dial-in / join instructions.
  const looksLikeInvite =
    /\b(zoom\.us|teams\.microsoft|meet\.google\.com)\b/.test(text) &&
    (/\b(password|passcode|meeting id)\b/.test(text) ||
      /\bone tap mobile\b/.test(text) ||
      /\byou can join this meeting\b/.test(text));
  return looksLikeInvite;
}

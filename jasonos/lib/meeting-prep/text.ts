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

/** First 300 characters of a calendar description, or null when it is empty. */
export function purposeFromCalendarDescription(
  description: string | null | undefined
): string | null {
  if (!description?.trim()) return null;
  const text = plainTextFromHtml(description).replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.slice(0, 300);
}

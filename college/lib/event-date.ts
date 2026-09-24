/** Pull a calendar date out of note titles, bodies, and filenames. */

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  const maxDay = new Date(year, month, 0).getDate();
  if (day < 1 || day > maxDay) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Best-effort date from free text (titles, PDF names like Key_Sept2026.pdf,
 * "September 15, 2026", "2026-09-15", "9/15/2026").
 * Month+year with no day → the 1st of that month.
 */
export function parseEventDateFromText(...parts: Array<string | null | undefined>): string | null {
  const text = parts.filter(Boolean).join(" \n ");
  if (!text.trim()) return null;

  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const hit = isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (hit) return hit;
  }

  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (slash) {
    const hit = isoDate(Number(slash[3]), Number(slash[1]), Number(slash[2]));
    if (hit) return hit;
  }

  const namedFull = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(20\d{2})\b/i,
  );
  if (namedFull) {
    const month = MONTHS[namedFull[1]!.toLowerCase()];
    if (month) {
      const hit = isoDate(Number(namedFull[3]), month, Number(namedFull[2]));
      if (hit) return hit;
    }
  }

  // Filenames like College_Career_Fair_Key_Sept2026.pdf or Sept2026
  // Underscore is a word char in JS, so don't require \b before the month.
  const glued = text.match(
    /(?:^|[^A-Za-z])(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[_\s-]*(20\d{2})\b/i,
  );
  if (glued) {
    const month = MONTHS[glued[1]!.toLowerCase()];
    if (month) {
      const hit = isoDate(Number(glued[2]), month, 1);
      if (hit) return hit;
    }
  }

  const monthYear = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(20\d{2})\b/i,
  );
  if (monthYear) {
    const month = MONTHS[monthYear[1]!.toLowerCase()];
    if (month) {
      const hit = isoDate(Number(monthYear[2]), month, 1);
      if (hit) return hit;
    }
  }

  return null;
}

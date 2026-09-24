/** Pull a calendar date out of note titles, bodies, filenames, and page text. */

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

const MONTH_ALT =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

export type EventDatePrecision = "day" | "month";

export type ParsedEventDate = {
  date: string;
  precision: EventDatePrecision;
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

function yearsInText(text: string): number[] {
  const years = new Set<number>();
  for (const match of text.matchAll(/\b(20\d{2})\b/g)) {
    years.add(Number(match[1]));
  }
  return [...years];
}

function defaultYear(text: string): number {
  const years = yearsInText(text);
  if (years.includes(2026)) return 2026;
  if (years.length) return years[0]!;
  return new Date().getFullYear();
}

function pushUnique(out: ParsedEventDate[], hit: ParsedEventDate | null) {
  if (!hit) return;
  if (out.some((row) => row.date === hit.date && row.precision === hit.precision)) return;
  out.push(hit);
}

/** All date candidates found in text, day-precision first when picking. */
export function parseEventDatesFromText(
  ...parts: Array<string | null | undefined>
): ParsedEventDate[] {
  const text = parts.filter(Boolean).join(" \n ");
  if (!text.trim()) return [];
  const out: ParsedEventDate[] = [];
  const yearHint = defaultYear(text);

  for (const match of text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) {
    const hit = isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
    pushUnique(out, hit ? { date: hit, precision: "day" } : null);
  }

  for (const match of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g)) {
    const hit = isoDate(Number(match[3]), Number(match[1]), Number(match[2]));
    pushUnique(out, hit ? { date: hit, precision: "day" } : null);
  }

  const namedFull = new RegExp(
    `\\b(${MONTH_ALT})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,)?\\s+(20\\d{2})\\b`,
    "gi",
  );
  for (const match of text.matchAll(namedFull)) {
    const month = MONTHS[match[1]!.toLowerCase()];
    if (!month) continue;
    const hit = isoDate(Number(match[3]), month, Number(match[2]));
    pushUnique(out, hit ? { date: hit, precision: "day" } : null);
  }

  // "30 September 2026"
  const dayMonthYear = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_ALT})(?:,)?\\s+(20\\d{2})\\b`,
    "gi",
  );
  for (const match of text.matchAll(dayMonthYear)) {
    const month = MONTHS[match[2]!.toLowerCase()];
    if (!month) continue;
    const hit = isoDate(Number(match[3]), month, Number(match[1]));
    pushUnique(out, hit ? { date: hit, precision: "day" } : null);
  }

  // "September 30" / "Sept 30th" — year from surrounding text (e.g. Sept2026)
  const namedDay = new RegExp(
    `\\b(${MONTH_ALT})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\s*,?\\s*20\\d{2})\\b`,
    "gi",
  );
  for (const match of text.matchAll(namedDay)) {
    const month = MONTHS[match[1]!.toLowerCase()];
    if (!month) continue;
    const hit = isoDate(yearHint, month, Number(match[2]));
    pushUnique(out, hit ? { date: hit, precision: "day" } : null);
  }

  // "30 September" without year
  const dayMonth = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_ALT})(?!\\s*,?\\s*20\\d{2})\\b`,
    "gi",
  );
  for (const match of text.matchAll(dayMonth)) {
    const month = MONTHS[match[2]!.toLowerCase()];
    if (!month) continue;
    const hit = isoDate(yearHint, month, Number(match[1]));
    pushUnique(out, hit ? { date: hit, precision: "day" } : null);
  }

  // Filenames like Key_Sept2026.pdf — month precision only
  const glued = new RegExp(
    `(?:^|[^A-Za-z])(${MONTH_ALT})[_\\s-]*(20\\d{2})\\b`,
    "gi",
  );
  for (const match of text.matchAll(glued)) {
    const month = MONTHS[match[1]!.toLowerCase()];
    if (!month) continue;
    const hit = isoDate(Number(match[2]), month, 1);
    pushUnique(out, hit ? { date: hit, precision: "month" } : null);
  }

  const monthYear = new RegExp(`\\b(${MONTH_ALT})\\s+(20\\d{2})\\b`, "gi");
  for (const match of text.matchAll(monthYear)) {
    const month = MONTHS[match[1]!.toLowerCase()];
    if (!month) continue;
    const hit = isoDate(Number(match[2]), month, 1);
    pushUnique(out, hit ? { date: hit, precision: "month" } : null);
  }

  return out;
}

/**
 * Best-effort single date. Prefers day-precision (e.g. September 30, 2026)
 * over month-only guesses from filenames (Sept2026 → the 1st).
 */
export function parseEventDateFromText(...parts: Array<string | null | undefined>): string | null {
  const candidates = parseEventDatesFromText(...parts);
  const day = candidates.find((row) => row.precision === "day");
  if (day) return day.date;
  return candidates[0]?.date ?? null;
}

import type { HandoffSlot } from "./types";

const ET = "America/New_York";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export function matchOfferedSlot(slots: HandoffSlot[], reply: string): HandoffSlot | null {
  const text = replyWords(reply);
  if (!text || !slots.length) return null;
  const ordered = [...slots].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const hits = ordered.filter((slot) => slotMentioned(slot, text, ordered));
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) return null;
  return ordinalSlot(text, ordered);
}

export function replyWords(body: string): string {
  const plain = body
    .replace(/\r/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ");
  const cut = plain.split(/\n-{2,}\s*original message\s*-{2,}|\nOn .{0,120} wrote:|\nFrom:\s/i)[0] ?? plain;
  return cut.replace(/\s+/g, " ").trim().toLowerCase();
}

function slotMentioned(slot: HandoffSlot, text: string, all: HandoffSlot[]): boolean {
  const when = parts(slot.start);
  const day = mentionsDay(text, when);
  const time = mentionsTime(text, when);
  const sameDay = all.filter((other) => sameCalendarDay(other.start, slot.start)).length;
  const sameTime = all.filter((other) => sameClock(other.start, slot.start)).length;
  if (day && time) return true;
  if (day && !textHasTime(text) && sameDay === 1) return true;
  if (time && !textHasDay(text) && sameTime === 1) return true;
  return false;
}

function ordinalSlot(text: string, ordered: HandoffSlot[]): HandoffSlot | null {
  if (textHasDay(text) || textHasTime(text)) return null;
  if (/\b(first|earliest)\b/.test(text)) return ordered[0] ?? null;
  if (/\bsecond\b/.test(text)) return ordered[1] ?? null;
  if (/\bthird\b/.test(text)) return ordered[2] ?? null;
  if (/\blast\b/.test(text)) return ordered[ordered.length - 1] ?? null;
  return null;
}

function parts(iso: string) {
  const date = new Date(iso);
  const weekday = date.toLocaleDateString("en-US", { timeZone: ET, weekday: "long" }).toLowerCase();
  const month = date.toLocaleDateString("en-US", { timeZone: ET, month: "long" }).toLowerCase();
  const day = Number(date.toLocaleDateString("en-US", { timeZone: ET, day: "numeric" }));
  const hour24 = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: ET, hour: "numeric", hourCycle: "h23" }).format(date)
  );
  const minute = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: ET, minute: "2-digit" }).format(date)
  );
  return {
    weekday,
    weekdayShort: weekday.slice(0, 3),
    month,
    monthShort: month.slice(0, 3),
    day,
    hour12: hour24 % 12 || 12,
    minute,
    ap: hour24 >= 12 ? "pm" : "am",
  };
}

function mentionsDay(text: string, when: ReturnType<typeof parts>): boolean {
  if (new RegExp(`\\b${when.weekday}\\b`).test(text)) return true;
  if (new RegExp(`\\b${when.weekdayShort}\\b`).test(text)) return true;
  const day = `${when.day}(?:st|nd|rd|th)?`;
  if (new RegExp(`\\b${when.month}\\s+${day}\\b`).test(text)) return true;
  if (new RegExp(`\\b${when.monthShort}\\.?\\s+${day}\\b`).test(text)) return true;
  return false;
}

function mentionsTime(text: string, when: ReturnType<typeof parts>): boolean {
  const hour = when.hour12;
  const min = String(when.minute).padStart(2, "0");
  if (new RegExp(`\\b${hour}:${min}\\s*${when.ap}\\b`).test(text)) return true;
  if (when.minute === 0 && new RegExp(`\\b${hour}\\s*${when.ap}\\b`).test(text)) return true;
  if (when.minute === 0 && when.ap === "pm" && new RegExp(`\\bafter\\s+${hour}\\b`).test(text)) return true;
  return false;
}

function textHasTime(text: string): boolean {
  return /\b\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?\b|\bafter\s+\d{1,2}\b/.test(text);
}

function textHasDay(text: string): boolean {
  return WEEKDAYS.some((day) => new RegExp(`\\b${day}\\b`).test(text))
    || MONTHS.some((month) => new RegExp(`\\b${month}\\b`).test(text));
}

function sameCalendarDay(a: string, b: string): boolean {
  const left = parts(a);
  const right = parts(b);
  return left.month === right.month && left.day === right.day;
}

function sameClock(a: string, b: string): boolean {
  const left = parts(a);
  const right = parts(b);
  return left.hour12 === right.hour12 && left.minute === right.minute && left.ap === right.ap;
}

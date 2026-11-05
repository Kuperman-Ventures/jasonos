import type { Likelihood } from "./schema";
import { nyDate } from "./edit";

export type NewsTone = "fresh" | "week" | "old";

export type NewsPresentation = {
  domain: string;
  icon: string;
  age: string;
  dateLabel: string;
  tone: NewsTone;
};

const TONE_COLOR: Record<NewsTone, string> = {
  fresh: "var(--pd-accent)",
  week: "var(--pd-neutral-600)",
  old: "var(--pd-neutral-400)",
};

export function newsToneColor(tone: NewsTone) {
  return TONE_COLOR[tone];
}

function dayNumber(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function formatDay(iso: string) {
  return new Date(dayNumber(iso)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function nyClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    stamp: Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), read("second")),
    day: Date.UTC(read("year"), read("month") - 1, read("day")),
  };
}

/** Age of a story against today's date in America/New_York. */
export function presentNews(item: { added: string; url: string }, now = new Date()): NewsPresentation {
  const days = Math.max(0, Math.round((dayNumber(nyDate(now)) - dayNumber(item.added)) / 864e5));
  const domain = new URL(item.url).hostname.replace(/^www\./, "");
  return {
    domain,
    icon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
    age: days === 0 ? "Added today" : days === 1 ? "Added yesterday" : `Added ${days} days ago`,
    dateLabel: formatDay(item.added),
    tone: days <= 1 ? "fresh" : days <= 7 ? "week" : "old",
  };
}

export type TodayFlag = {
  left: string;
  label: string;
  nextIndex: number;
};

/**
 * Places the Today flag. `nextIndex` is the first date that is today or later
 * in America/New_York, or -1 when every date has passed.
 * For four items the column span is 75 percent, which is `(n - 1) / n`.
 */
export function todayFlagPosition(dates: string[], now = new Date()): TodayFlag | null {
  if (!dates.length || dates.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date))) return null;
  const stamps = dates.map(dayNumber);
  const count = stamps.length;
  const clock = nyClock(now);
  const nextIndex = stamps.findIndex((stamp) => stamp >= clock.day);
  let progress = 0;
  if (nextIndex === -1) progress = 1;
  else if (nextIndex > 0 && count > 1) {
    const span = stamps[nextIndex] - stamps[nextIndex - 1];
    progress = (nextIndex - 1 + (clock.stamp - stamps[nextIndex - 1]) / span) / (count - 1);
  }
  const percent = Math.round(progress * 1000) / 10;
  const columnSpan = count > 1 ? (count - 1) / count : 1;
  return {
    left: `${percent * columnSpan}%`,
    label: formatDay(nyDate(now)),
    nextIndex,
  };
}

export function timelineTag(index: number, nextIndex: number): "Done" | "Next" | null {
  if (nextIndex === -1 || index < nextIndex) return "Done";
  if (index === nextIndex) return "Next";
  return null;
}

export function countNote(filter: "all" | Likelihood, total: number) {
  return filter === "all" ? `All ${total} areas` : `Filtered: ${filter} likelihood`;
}

export function counterLines(label: string) {
  if (label.includes("\n")) return label.split("\n");
  if (label.trim() === "Investigations in process or on deck") {
    return ["Investigations", "in process", "or on deck"];
  }
  return [label];
}

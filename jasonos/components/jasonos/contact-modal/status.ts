import type { WordPillTone } from "@/components/jasonos/contact-modal/parts";

export function daysUntil(date: string, today: string): number {
  return Math.round(
    (new Date(`${date}T00:00:00`).getTime() -
      new Date(`${today}T00:00:00`).getTime()) /
      86_400_000
  );
}

export function scheduleWordPill(
  date: string | null,
  today: string
): { label: string; tone: WordPillTone } | null {
  if (!date) return null;
  const days = daysUntil(date, today);
  if (days < 0) {
    const n = Math.abs(days);
    return {
      label: n === 1 ? "1 DAY OVERDUE" : `${n} DAYS OVERDUE`,
      tone: "magenta",
    };
  }
  if (days === 0) return { label: "DUE TODAY", tone: "yellow" };
  if (days === 1) return { label: "DUE IN 1 DAY", tone: "yellow" };
  if (days <= 7) return { label: `DUE IN ${days} DAYS`, tone: "yellow" };
  return { label: `SCHEDULED IN ${days}D`, tone: "cyan" };
}

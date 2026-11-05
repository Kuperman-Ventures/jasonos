import type { Likelihood, NewsItem, TimelineItem } from "./data";

export type NewsCard = NewsItem & {
  domain: string;
  icon: string;
  age: string;
  dateLabel: string;
  dot: string;
};

export type TimelineCard = TimelineItem & {
  opacity: number;
  dot: string;
  tag: "Done" | "Next" | null;
};

export type TimelineView = {
  items: TimelineCard[];
  todayLeft: string;
  todayLabel: string;
};

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function decorateNews(items: NewsItem[], now: Date): NewsCard[] {
  const today = dayStart(now);
  return items.map((item) => {
    const [year, month, day] = item.added.split("-").map(Number);
    const added = new Date(year, month - 1, day);
    const days = Math.max(0, Math.round((today.getTime() - added.getTime()) / 864e5));
    const domain = new URL(item.url).hostname.replace(/^www\./, "");
    return {
      ...item,
      domain,
      icon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
      age:
        days === 0 ? "Added today" : days === 1 ? "Added yesterday" : `Added ${days} days ago`,
      dateLabel: added.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      dot:
        days <= 1
          ? "var(--color-accent)"
          : days <= 7
            ? "var(--color-neutral-600)"
            : "var(--color-neutral-400)",
    };
  });
}

/** Places the Today marker the way the artifact does: column starts, not the far edge. */
export function decorateTimeline(items: TimelineItem[], now: Date): TimelineView {
  const stamps = items.map((item) => new Date(`${item.date}T00:00:00`).getTime());
  const count = stamps.length;
  const nextIndex = stamps.findIndex((stamp) => stamp >= now.getTime());
  let progress = 0;
  if (nextIndex === -1) progress = 1;
  else if (nextIndex > 0 && count > 1) {
    const span = stamps[nextIndex] - stamps[nextIndex - 1];
    progress =
      (nextIndex - 1 + (now.getTime() - stamps[nextIndex - 1]) / span) / (count - 1);
  }
  const percent = Math.round(progress * 1000) / 10;
  const columnSpan = count > 1 ? (count - 1) / count : 1;
  return {
    todayLeft: `${percent * columnSpan}%`,
    todayLabel: now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    items: items.map((item, index) => {
      const past = nextIndex === -1 || index < nextIndex;
      const next = index === nextIndex;
      return {
        ...item,
        opacity: past ? 0.55 : 1,
        dot: past
          ? "var(--color-neutral-600)"
          : next
            ? "var(--color-accent)"
            : "var(--color-text)",
        tag: past ? "Done" : next ? "Next" : null,
      };
    }),
  };
}

export function countNote(filter: "all" | Likelihood) {
  return filter === "all" ? "All six areas" : `Filtered: ${filter} likelihood`;
}

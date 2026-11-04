import { mondayStartOfWeekYmd } from "../dates";

export type WebinarRange = "week" | "4w" | "all";

export function weekdayDate(ymd: string): string {
  const date = new Date(`${ymd}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return ymd;
  const weekday = date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const month = date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `${weekday} ${month} ${date.getUTCDate()}`;
}

export function durationLabel(minutes: number | null | undefined): string | null {
  if (minutes == null || minutes <= 0) return null;
  return `${minutes} min`;
}

/** First sentence of a markdown summary, with the markdown marks removed. */
export function firstSentence(markdown: string): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  const match = plain.match(/^[\s\S]*?[.!?]/);
  return (match?.[0] ?? plain).trim();
}

export function speakerLine(speakers: unknown): string | null {
  if (!Array.isArray(speakers) || !speakers.length) return null;
  const parts = speakers
    .map((speaker) => {
      if (!speaker || typeof speaker !== "object") return null;
      const row = speaker as { name?: string; org?: string };
      if (!row.name?.trim()) return null;
      return row.org?.trim() ? `${row.name.trim()}, ${row.org.trim()}` : row.name.trim();
    })
    .filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(" · ") : null;
}

export function monogram(host: string, title: string): string {
  const source = host.trim() || title.trim();
  const letters = source.replace(/[^A-Za-z0-9]/g, "");
  return (letters.slice(0, 2) || "W").toUpperCase();
}

export function sourceInitials(session: {
  transcript_source: string | null;
  detection: string;
}): string {
  if (session.detection === "calendar_only") return "Ca";
  if (session.transcript_source === "granola") return "Gr";
  if (session.transcript_source === "wispr") return "Wi";
  return "Ca";
}

export function shortTopicName(name: string): string {
  const [head] = name.split(/\s+and\s+/i);
  return (head || name).trim();
}

export function countPhrase(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function weekEyebrow(range: WebinarRange, todayYmd: string): string {
  if (range === "4w") return "Last 4 weeks";
  if (range === "all") return "All time";
  const monday = mondayStartOfWeekYmd(todayYmd);
  const date = new Date(`${monday}T12:00:00Z`);
  const month = date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `Week of ${month} ${date.getUTCDate()}`;
}

export function rangeWhen(range: WebinarRange): string {
  if (range === "week") return "this week";
  if (range === "4w") return "in the last 4 weeks";
  return "all time";
}

export function actionsHeading(range: WebinarRange): string {
  if (range === "week") return "Actions from this week";
  if (range === "4w") return "Actions from the last 4 weeks";
  return "Actions from all time";
}

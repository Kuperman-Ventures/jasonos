/** Calendar events created from Ingest (and later the Calendar section). */

import { isOwner, type Owner } from "@/lib/types";

export type CalendarEvent = {
  id: string;
  title: string;
  /** YYYY-MM-DD when known. */
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  notes: string;
  createdAt: string;
  createdBy: Owner;
  sourceId: string | null;
  assetUrl: string | null;
  assetPath: string | null;
};

export function normalizeCalendarEvents(raw: unknown): CalendarEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: CalendarEvent[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    if (!id) continue;
    out.push({
      id,
      title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : "Untitled",
      date:
        typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : null,
      startTime: typeof item.startTime === "string" && item.startTime ? item.startTime : null,
      endTime: typeof item.endTime === "string" && item.endTime ? item.endTime : null,
      notes: typeof item.notes === "string" ? item.notes : "",
      createdAt:
        typeof item.createdAt === "string" && item.createdAt
          ? item.createdAt
          : new Date().toISOString(),
      createdBy:
        typeof item.createdBy === "string" && isOwner(item.createdBy) ? item.createdBy : "jason",
      sourceId: typeof item.sourceId === "string" && item.sourceId ? item.sourceId : null,
      assetUrl: typeof item.assetUrl === "string" && item.assetUrl ? item.assetUrl : null,
      assetPath: typeof item.assetPath === "string" && item.assetPath ? item.assetPath : null,
    });
  }
  return out;
}

export function shortEventDate(isoDate: string | null): string {
  if (!isoDate) return "Undated";
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Notes pinboard — structured items created by Ingest, listed on the Notes tab. */

import { isOwner, type Owner } from "@/lib/types";

export type NoteKind = "website" | "document" | "note" | "recording";

export type NoteBoardFilter = "all" | "for-me" | "links" | "docs" | "notes";

export type PinNote = {
  id: string;
  title: string;
  kind: NoteKind;
  /** Who ingested / added this item. */
  addedBy: Owner;
  createdAt: string;
  /** Named reviewers still responsible (or originally assigned). */
  reviewers: Owner[];
  /** Reviewers who already marked this reviewed. */
  reviewedBy: Owner[];
  /** Optional review-by date (YYYY-MM-DD). */
  reviewDue: string | null;
  /** Source payload shown on the plate / detail. */
  body: string;
  /** Website host when kind is website. */
  host: string | null;
  /** Absolute or relative URL for website items. */
  url: string | null;
  /** Page count for documents when known. */
  pageCount: number | null;
  /** Running time label for recordings, e.g. "48 min". */
  durationLabel: string | null;
  /** Ingest source id when this came from Ingest. */
  sourceId: string | null;
};

export type NoteBand = {
  id: string;
  label: string;
  rangeLabel: string;
  items: PinNote[];
};

const FILTER_STORAGE = "kyle-notes-filter";

export function noteFilterStorageKey(memberId: string): string {
  return `${FILTER_STORAGE}:${memberId}`;
}

export function isNoteKind(value: unknown): value is NoteKind {
  return value === "website" || value === "document" || value === "note" || value === "recording";
}

export function isNoteBoardFilter(value: unknown): value is NoteBoardFilter {
  return (
    value === "all" ||
    value === "for-me" ||
    value === "links" ||
    value === "docs" ||
    value === "notes"
  );
}

export function kindLabel(kind: NoteKind): string {
  switch (kind) {
    case "website":
      return "Website";
    case "document":
      return "PDF";
    case "note":
      return "Note";
    case "recording":
      return "Recording";
  }
}

export function kindFromIngestSource(kind: "paste" | "url" | "file"): NoteKind {
  if (kind === "url") return "website";
  if (kind === "file") return "document";
  return "note";
}

export function hostFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

export function waitingOnViewer(item: PinNote, viewer: Owner): boolean {
  return item.reviewers.includes(viewer) && !item.reviewedBy.includes(viewer);
}

export function reviewInstruction(item: PinNote, viewer: Owner): string | null {
  if (!waitingOnViewer(item, viewer)) return null;
  const others = item.reviewers.filter((id) => id !== viewer && !item.reviewedBy.includes(id));
  const due = item.reviewDue
    ? new Date(`${item.reviewDue}T12:00:00`).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;
  if (others.length === 0) {
    return due ? `Review by ${due} · you` : "Review · you";
  }
  const names = others.map((id) => id.charAt(0).toUpperCase() + id.slice(1));
  const who =
    names.length === 1 ? `you and ${names[0]}` : `you and ${names.length} others`;
  return due ? `Review by ${due} · ${who}` : `Review · ${who}`;
}

export function filterPinNotes(
  items: PinNote[],
  filter: NoteBoardFilter,
  viewer: Owner,
): PinNote[] {
  switch (filter) {
    case "for-me":
      return items.filter((item) => waitingOnViewer(item, viewer));
    case "links":
      return items.filter((item) => item.kind === "website");
    case "docs":
      return items.filter((item) => item.kind === "document");
    case "notes":
      return items.filter((item) => item.kind === "note" || item.kind === "recording");
    default:
      return items;
  }
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatRange(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth();
  const left = start.toLocaleString("en-US", { month: "short", day: "numeric" });
  const right = end.toLocaleString("en-US", {
    month: sameMonth ? undefined : "short",
    day: "numeric",
  });
  return `${left} – ${right}`;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Group newest-first items into This week / Last week / Month bands. Empty bands omitted. */
export function bandPinNotes(items: PinNote[], now = new Date()): NoteBand[] {
  const sorted = [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  if (!sorted.length) return [];

  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const thisWeekEnd = addDays(thisWeekStart, 6);
  const lastWeekEnd = addDays(lastWeekStart, 6);

  const thisWeek: PinNote[] = [];
  const lastWeek: PinNote[] = [];
  const months = new Map<string, PinNote[]>();

  for (const item of sorted) {
    const when = new Date(item.createdAt);
    if (Number.isNaN(when.getTime())) continue;
    const day = new Date(when);
    day.setHours(0, 0, 0, 0);
    if (day >= thisWeekStart && day <= thisWeekEnd) {
      thisWeek.push(item);
    } else if (day >= lastWeekStart && day <= lastWeekEnd) {
      lastWeek.push(item);
    } else {
      const key = monthKey(when);
      const bucket = months.get(key) ?? [];
      bucket.push(item);
      months.set(key, bucket);
    }
  }

  const bands: NoteBand[] = [];
  if (thisWeek.length) {
    bands.push({
      id: "this-week",
      label: "This week",
      rangeLabel: formatRange(thisWeekStart, thisWeekEnd),
      items: thisWeek,
    });
  }
  if (lastWeek.length) {
    bands.push({
      id: "last-week",
      label: "Last week",
      rangeLabel: formatRange(lastWeekStart, lastWeekEnd),
      items: lastWeek,
    });
  }

  const monthKeys = [...months.keys()].sort((a, b) => b.localeCompare(a));
  for (const key of monthKeys) {
    const rows = months.get(key)!;
    const [year, month] = key.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    bands.push({
      id: `month-${key}`,
      label: start.toLocaleString("en-US", { month: "long", year: "numeric" }),
      rangeLabel: formatRange(start, end),
      items: rows,
    });
  }

  return bands;
}

export function shortPinDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { month: "short", day: "numeric" });
}

export function normalizePinNotes(raw: unknown): PinNote[] {
  if (!Array.isArray(raw)) return [];
  const out: PinNote[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    if (!id) continue;
    const kind = isNoteKind(item.kind) ? item.kind : "note";
    const addedBy =
      typeof item.addedBy === "string" && isOwner(item.addedBy) ? item.addedBy : "jason";
    const reviewers = Array.isArray(item.reviewers)
      ? item.reviewers.filter((id): id is Owner => typeof id === "string" && isOwner(id))
      : [];
    const reviewedBy = Array.isArray(item.reviewedBy)
      ? item.reviewedBy.filter((id): id is Owner => typeof id === "string" && isOwner(id))
      : [];
    out.push({
      id,
      title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : "Untitled",
      kind,
      addedBy,
      createdAt:
        typeof item.createdAt === "string" && item.createdAt
          ? item.createdAt
          : new Date().toISOString(),
      reviewers,
      reviewedBy,
      reviewDue:
        typeof item.reviewDue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.reviewDue)
          ? item.reviewDue
          : null,
      body: typeof item.body === "string" ? item.body : "",
      host: typeof item.host === "string" && item.host ? item.host : null,
      url: typeof item.url === "string" && item.url ? item.url : null,
      pageCount:
        typeof item.pageCount === "number" && Number.isFinite(item.pageCount)
          ? Math.max(0, Math.round(item.pageCount))
          : null,
      durationLabel:
        typeof item.durationLabel === "string" && item.durationLabel
          ? item.durationLabel
          : null,
      sourceId: typeof item.sourceId === "string" && item.sourceId ? item.sourceId : null,
    });
  }
  return out;
}

/** Turn the old shared textarea into pin notes once, so nothing is lost. */
export function migrateLegacyNotesText(notes: string, addedBy: Owner = "jason"): PinNote[] {
  const text = notes.trim();
  if (!text) return [];

  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const items: PinNote[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!;
    const ingestMatch = block.match(/^From Ingest · (.+?) · (.+)\n([\s\S]*)$/);
    if (ingestMatch) {
      const title = ingestMatch[1]!.trim();
      const whenRaw = ingestMatch[2]!.trim();
      const body = ingestMatch[3]!
        .split("\n")
        .map((line) => line.replace(/^•\s*/, "").trim())
        .filter(Boolean)
        .join("\n");
      const parsed = Date.parse(whenRaw);
      items.push({
        id: `legacy-ingest-${index + 1}`,
        title: title || "From Ingest",
        kind: "note",
        addedBy,
        createdAt: Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString(),
        reviewers: [],
        reviewedBy: [],
        reviewDue: null,
        body,
        host: null,
        url: null,
        pageCount: null,
        durationLabel: null,
        sourceId: null,
      });
      continue;
    }

    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const title = (lines[0] ?? "Note").slice(0, 120);
    const body = lines.slice(1).join("\n") || lines[0] || "";
    items.push({
      id: `legacy-note-${index + 1}`,
      title,
      kind: "note",
      addedBy,
      createdAt: new Date(Date.now() - index * 86_400_000).toISOString(),
      reviewers: [],
      reviewedBy: [],
      reviewDue: null,
      body,
      host: null,
      url: null,
      pageCount: null,
      durationLabel: null,
      sourceId: null,
    });
  }

  return items;
}

export function buildPinNotesFromIngest(input: {
  sourceId: string;
  sourceTitle: string;
  sourceKind: "paste" | "url" | "file";
  sourceText: string;
  sourceUrl?: string | null;
  createdAt: string;
  addedBy: Owner;
  noteLabels: string[];
}): PinNote[] {
  const labels = input.noteLabels.map((label) => label.trim()).filter(Boolean);
  if (!labels.length) return [];

  const kind = kindFromIngestSource(input.sourceKind);
  const host =
    kind === "website"
      ? hostFromUrl(input.sourceUrl) ?? hostFromUrl(input.sourceText.split(/\s+/).find((t) => /^https?:\/\//i.test(t)))
      : null;
  const url =
    kind === "website"
      ? input.sourceUrl ??
        input.sourceText.split(/\s+/).find((t) => /^https?:\/\//i.test(t)) ??
        null
      : null;

  // One pin per note row — title is the user-facing line; body keeps source excerpt.
  return labels.map((label, index) => ({
    id: `note-${input.sourceId.slice(0, 8)}-${index + 1}-${Math.random().toString(36).slice(2, 7)}`,
    title: label.slice(0, 160),
    kind,
    addedBy: input.addedBy,
    createdAt: input.createdAt,
    reviewers: [],
    reviewedBy: [],
    reviewDue: null,
    body:
      kind === "note"
        ? label
        : [label, input.sourceText.trim().slice(0, 600)].filter(Boolean).join("\n\n"),
    host,
    url,
    pageCount: kind === "document" ? null : null,
    durationLabel: null,
    sourceId: input.sourceId,
  }));
}

export function markPinReviewed(items: PinNote[], id: string, viewer: Owner): PinNote[] {
  return items.map((item) => {
    if (item.id !== id) return item;
    if (item.reviewedBy.includes(viewer)) return item;
    return { ...item, reviewedBy: [...item.reviewedBy, viewer] };
  });
}

/** Stable avatar ground color per household member (white initials). */
export function ownerAvatarGround(owner: Owner): string {
  switch (owner) {
    case "kyle":
      return "var(--color-accent-2-800)";
    case "jason":
      return "#2f1a52";
    case "kat":
      return "var(--color-accent-800)";
  }
}

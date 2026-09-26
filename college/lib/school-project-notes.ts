/** School detail → Project Management → Notes composer + routing. */

import { INBOX_PARENT_ID, type PersistedProjectStep } from "@/lib/ingest";
import type { CalendarEvent } from "@/lib/calendar-events";
import type { PinNote } from "@/lib/note-board";
import { isOwner, type Owner } from "@/lib/types";

export type NoteDest = "todo" | "notes" | "calendar";

export type SchoolProjectNote = {
  id: string;
  text: string;
  userId: Owner;
  schoolId: string;
  dests: NoteDest[];
  /** YYYY-MM-DD when To-Do and/or Calendar was selected. */
  date: string;
  createdAt: string;
};

export type NoteDestToggles = Record<NoteDest, boolean>;

export const DEFAULT_NOTE_DESTS: NoteDestToggles = {
  todo: true,
  notes: false,
  calendar: false,
};

export const NOTE_DEST_LABELS: Record<NoteDest, string> = {
  todo: "To-Do",
  notes: "Notes",
  calendar: "Calendar",
};

export function isNoteDest(value: unknown): value is NoteDest {
  return value === "todo" || value === "notes" || value === "calendar";
}

export function normalizeSchoolProjectNotes(raw: unknown): SchoolProjectNote[] {
  if (!Array.isArray(raw)) return [];
  const out: SchoolProjectNote[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    const text = typeof item.text === "string" ? item.text.trim() : "";
    const schoolId = typeof item.schoolId === "string" ? item.schoolId : "";
    if (!id || !text || !schoolId) continue;
    const userId =
      typeof item.userId === "string" && isOwner(item.userId) ? item.userId : "jason";
    const dests = Array.isArray(item.dests)
      ? item.dests.filter((d): d is NoteDest => isNoteDest(d))
      : [];
    if (!dests.length) continue;
    out.push({
      id,
      text,
      userId,
      schoolId,
      dests,
      date:
        typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : "",
      createdAt:
        typeof item.createdAt === "string" && item.createdAt
          ? item.createdAt
          : new Date().toISOString(),
    });
  }
  return out;
}

export function pickedDests(dest: NoteDestToggles): NoteDest[] {
  return (Object.keys(dest) as NoteDest[]).filter((key) => dest[key]);
}

export function dateFieldLabel(dest: NoteDestToggles): string {
  if (dest.calendar && dest.todo) return "Date (due + calendar)";
  if (dest.calendar) return "Calendar date";
  return "Due (optional)";
}

export function needsNoteDate(dest: NoteDestToggles): boolean {
  return dest.todo || dest.calendar;
}

export function canSendSchoolNote(input: {
  text: string;
  dest: NoteDestToggles;
  date: string;
}): boolean {
  const text = input.text.trim();
  const picked = pickedDests(input.dest);
  if (!text || !picked.length) return false;
  if (input.dest.calendar && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return false;
  return true;
}

export function joinDestLabels(dests: NoteDest[]): string {
  const labels = dests.map((d) => NOTE_DEST_LABELS[d]);
  if (labels.length < 2) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export function previewLead(dests: NoteDest[]): string {
  if (!dests.length) {
    return "Pick at least one destination. It will be tagged";
  }
  return `Shows up in ${joinDestLabels(dests)} tagged`;
}

/** Short month+day without year, for route meta lines. */
export function shortNoteDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function noteRoutesLabel(note: SchoolProjectNote): string {
  return note.dests
    .map((dest) => {
      const label = NOTE_DEST_LABELS[dest];
      if ((dest === "todo" || dest === "calendar") && note.date) {
        return `${label} ${shortNoteDate(note.date)}`;
      }
      return label;
    })
    .join(" · ");
}

export function logTitle(userName: string, schoolName: string): string {
  return `${userName}'s ${schoolName} Notes`;
}

export function newSchoolProjectNoteId(): string {
  return `spn-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildSchoolProjectNote(input: {
  text: string;
  userId: Owner;
  schoolId: string;
  dest: NoteDestToggles;
  date: string;
  now?: Date;
}): SchoolProjectNote | null {
  if (!canSendSchoolNote(input)) return null;
  const now = input.now ?? new Date();
  const dests = pickedDests(input.dest);
  return {
    id: newSchoolProjectNoteId(),
    text: input.text.trim(),
    userId: input.userId,
    schoolId: input.schoolId,
    dests,
    date: needsNoteDate(input.dest) && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : "",
    createdAt: now.toISOString(),
  };
}

export type RoutedSchoolNotePayload = {
  note: SchoolProjectNote;
  todo: PersistedProjectStep | null;
  pin: PinNote | null;
  calendar: CalendarEvent | null;
};

/** Build the destination records for a school project note. */
export function routeSchoolNote(note: SchoolProjectNote): RoutedSchoolNotePayload {
  const todo: PersistedProjectStep | null = note.dests.includes("todo")
    ? {
        id: `todo-${Math.random().toString(36).slice(2, 10)}`,
        label: note.text,
        owner: note.userId,
        assignedBy: note.userId,
        parentId: INBOX_PARENT_ID,
        dueDate: note.date || null,
        startDate: null,
        endDate: null,
        sourceId: null,
        createdAt: note.createdAt,
        schoolId: note.schoolId,
        sourceNoteId: note.id,
      }
    : null;

  const pin: PinNote | null = note.dests.includes("notes")
    ? {
        id: `pin-${Math.random().toString(36).slice(2, 10)}`,
        title: note.text.length > 72 ? `${note.text.slice(0, 69).trimEnd()}…` : note.text,
        kind: "note",
        addedBy: note.userId,
        createdAt: note.createdAt,
        reviewers: [],
        reviewedBy: [],
        reviewDue: null,
        body: note.text,
        host: null,
        url: null,
        pageCount: null,
        durationLabel: null,
        sourceId: null,
        assetUrl: null,
        assetPath: null,
        mimeType: null,
        previewImageUrl: null,
        previewSummary: null,
        schoolId: note.schoolId,
        sourceNoteId: note.id,
      }
    : null;

  const calendar: CalendarEvent | null = note.dests.includes("calendar")
    ? {
        id: `cal-${Math.random().toString(36).slice(2, 10)}`,
        title: note.text,
        date: note.date || null,
        startTime: null,
        endTime: null,
        notes: "",
        createdAt: note.createdAt,
        createdBy: note.userId,
        sourceId: null,
        assetUrl: null,
        assetPath: null,
        schoolId: note.schoolId,
        sourceNoteId: note.id,
      }
    : null;

  return { note, todo, pin, calendar };
}

export type SchoolPmSubtab = "notes" | "contacts" | "visit" | "touch" | "deadlines";

export function isSchoolPmSubtab(value: unknown): value is SchoolPmSubtab {
  return (
    value === "notes" ||
    value === "contacts" ||
    value === "visit" ||
    value === "touch" ||
    value === "deadlines"
  );
}

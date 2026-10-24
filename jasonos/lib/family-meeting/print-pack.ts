import { groupEventsByDay } from "./days";
import { locationForDisplay } from "./icons";
import { dayKeyForEvent } from "./keys";
import { printWeekFromFreezeFriday } from "./print-window";
import { splitAgendaLists } from "./collapse";
import type {
  FamilyCalendarGroupId,
  FamilyMeetingAgenda,
  FamilyMeetingEvent,
} from "./types";
import { FAMILY_MEETING_TIMEZONE } from "./weekend";

export type PrintSheetId =
  | "family"
  | "kat_jason"
  | "kyle_kat_jason"
  | "wyatt_kat_jason";

export interface PrintSheetEvent {
  id: string;
  title: string;
  startsAt: string;
  allDay: boolean;
  timeLabel: string;
  location: string | null;
  sourceGroupId: FamilyCalendarGroupId;
  sourceLabel: string;
  headsUp: boolean;
  routine: boolean;
}

export interface PrintSheetDay {
  key: string;
  weekday: string;
  date: string;
  events: PrintSheetEvent[];
}

export interface PrintSheet {
  id: PrintSheetId;
  label: string;
  days: PrintSheetDay[];
  rhythm: { title: string; meta: string }[];
  headsUps: PrintSheetEvent[];
}

export interface FamilyMeetingPrintPackPayload {
  freezeFriday: string;
  rangeStart: string;
  rangeEnd: string;
  label: string;
  generatedAt: string;
  sheets: PrintSheet[];
}

const SHEET_META: { id: PrintSheetId; label: string }[] = [
  { id: "family", label: "Kuperman Family" },
  { id: "kat_jason", label: "Kat & Jason" },
  { id: "kyle_kat_jason", label: "Kyle" },
  { id: "wyatt_kat_jason", label: "Wyatt" },
];

function sourceLabel(id: FamilyCalendarGroupId): string {
  switch (id) {
    case "family":
      return "Kuperman Family";
    case "kat_jason":
      return "Kat & Jason";
    case "kyle_kat_jason":
      return "Kyle";
    case "wyatt_kat_jason":
      return "Wyatt";
  }
}

function clockLabel(ev: FamilyMeetingEvent): string {
  if (ev.allDay) return "All day";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: FAMILY_MEETING_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ev.startsAt));
}

function toPrintEvent(ev: FamilyMeetingEvent): PrintSheetEvent {
  return {
    id: ev.id,
    title: ev.title,
    startsAt: ev.startsAt,
    allDay: ev.allDay,
    timeLabel: clockLabel(ev),
    location: locationForDisplay(ev.location),
    sourceGroupId: ev.groupId,
    sourceLabel: sourceLabel(ev.groupId),
    headsUp: ev.presentation === "heads_up",
    routine: Boolean(ev.routine),
  };
}

function inPrintRange(
  ev: FamilyMeetingEvent,
  startKey: string,
  endExclusiveKey: string
): boolean {
  const day = ev.dayKey ?? dayKeyForEvent(ev.startsAt);
  return day >= startKey && day < endExclusiveKey;
}

/**
 * Which source lanes feed a print sheet.
 * Family events go on every sheet. Kid calendars also land on Kat & Jason.
 */
export function sourceLanesForSheet(
  sheetId: PrintSheetId
): FamilyCalendarGroupId[] {
  switch (sheetId) {
    case "family":
      return ["family"];
    case "kat_jason":
      return ["family", "kat_jason", "kyle_kat_jason", "wyatt_kat_jason"];
    case "kyle_kat_jason":
      return ["family", "kyle_kat_jason"];
    case "wyatt_kat_jason":
      return ["family", "wyatt_kat_jason"];
  }
}

function formatRhythmMeta(evs: FamilyMeetingEvent[]): string {
  const weekdays = [
    ...new Set(
      evs.map((e) =>
        new Intl.DateTimeFormat("en-US", {
          timeZone: FAMILY_MEETING_TIMEZONE,
          weekday: "short",
        }).format(new Date(e.startsAt))
      )
    ),
  ];
  const dates = [
    ...new Set(
      evs.map((e) =>
        new Intl.DateTimeFormat("en-US", {
          timeZone: FAMILY_MEETING_TIMEZONE,
          month: "short",
          day: "numeric",
        }).format(new Date(e.startsAt))
      )
    ),
  ];
  const times = [
    ...new Set(evs.filter((e) => !e.allDay).map((e) => clockLabel(e))),
  ];
  const when =
    times.length === 1
      ? `${weekdays.join(" · ")} · ${times[0]}`
      : weekdays.join(" · ");
  const dateBit =
    dates.length <= 2 ? dates.join(" & ") : `${dates[0]} +${dates.length - 1}`;
  return `${when} · ${dateBit}`;
}

/** Build the four-sheet print payload from the live (edited) agenda. */
export function buildPrintPackPayload(
  agenda: FamilyMeetingAgenda,
  freezeFriday: string
): FamilyMeetingPrintPackPayload {
  const week = printWeekFromFreezeFriday(freezeFriday);
  const byGroup = new Map(
    agenda.groups.map((g) => [g.group.id as FamilyCalendarGroupId, g.events])
  );

  const allInRange = agenda.groups.flatMap((g) =>
    g.events.filter((e) =>
      inPrintRange(e, week.rangeStartKey, week.rangeEndExclusiveKey)
    )
  );
  const globalHeadsUps = allInRange
    .filter((e) => e.presentation === "heads_up")
    .map(toPrintEvent);

  const sheets: PrintSheet[] = SHEET_META.map((meta) => {
    const lanes = sourceLanesForSheet(meta.id);
    const pooled: FamilyMeetingEvent[] = [];
    for (const laneId of lanes) {
      for (const ev of byGroup.get(laneId) ?? []) {
        if (!inPrintRange(ev, week.rangeStartKey, week.rangeEndExclusiveKey)) {
          continue;
        }
        pooled.push(ev);
      }
    }
    // Dedup by occurrence key across lanes
    const seen = new Set<string>();
    const unique = pooled.filter((ev) => {
      const key = ev.occurrenceKey ?? ev.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const headsUps = [
      ...globalHeadsUps,
      ...unique
        .filter((e) => e.presentation === "heads_up")
        .map(toPrintEvent),
    ];
    const headsSeen = new Set<string>();
    const headsUnique = headsUps.filter((h) => {
      if (headsSeen.has(h.id)) return false;
      headsSeen.add(h.id);
      return true;
    });

    const nonHeads = unique.filter((e) => e.presentation !== "heads_up");
    const { spotlight, routines } = splitAgendaLists(nonHeads);
    const days = groupEventsByDay(spotlight).map((d) => ({
      key: d.key,
      weekday: d.weekday,
      date: d.date,
      events: d.events.map(toPrintEvent),
    }));

    const rhythm = routines.map((r) => ({
      title: r.title,
      meta: formatRhythmMeta(r.occurrences),
    }));

    return {
      id: meta.id,
      label: meta.label,
      days,
      rhythm,
      headsUps: headsUnique,
    };
  });

  return {
    freezeFriday,
    rangeStart: week.rangeStartKey,
    rangeEnd: week.rangeEndKey,
    label: week.label,
    generatedAt: new Date().toISOString(),
    sheets,
  };
}

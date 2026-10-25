import type { FamilyMeetingIconId } from "./icons";

export type FamilyCalendarGroupId =
  | "family"
  | "kat_jason"
  | "kyle_kat_jason"
  | "wyatt_kat_jason";

export interface FamilyCalendarGroup {
  id: FamilyCalendarGroupId;
  label: string;
  shortLabel: string;
  /** Match iCloud / Google calendar display names (case-insensitive). */
  nameMatchers: RegExp[];
  accent: string;
  ink: string;
}

/** Serializable lane chrome for the client editor (no RegExp). */
export interface FamilyCalendarGroupView {
  id: FamilyCalendarGroupId;
  label: string;
  shortLabel: string;
  accent: string;
  ink: string;
}

export type FamilyMeetingPresentation =
  | "auto"
  | "spotlight"
  | "routine"
  | "heads_up";

export interface FamilyMeetingEvent {
  id: string;
  uid: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location?: string;
  notes?: string;
  calendarName: string;
  calendarHref: string;
  groupId: FamilyCalendarGroupId;
  /**
   * Week-to-week repeat (same series or title on 2+ days in the window).
   * Rendered with a quieter list treatment.
   */
  routine?: boolean;
  /** Stable keys for editor persistence. */
  seriesKey?: string;
  occurrenceKey?: string;
  dayKey?: string;
  /** Persisted presentation override after edits are applied. */
  presentation?: FamilyMeetingPresentation;
  /** Persisted icon override (series-level). Null/undefined = auto discern. */
  iconId?: FamilyMeetingIconId | null;
}

export interface FamilyMeetingGroupAgenda {
  group: FamilyCalendarGroup;
  calendarName: string | null;
  events: FamilyMeetingEvent[];
  missingCalendar: boolean;
}

export interface FamilyMeetingGroupAgendaView {
  group: FamilyCalendarGroupView;
  calendarName: string | null;
  events: FamilyMeetingEvent[];
  missingCalendar: boolean;
}

export interface FamilyMeetingAgenda {
  generatedAt: string;
  weekendLabel: string;
  rangeStart: string;
  rangeEnd: string;
  timezone: string;
  connected: boolean;
  appleIdMasked: string | null;
  error: string | null;
  warnings: string[];
  groups: FamilyMeetingGroupAgenda[];
  totalEvents: number;
  /** YYYY-MM-DD open day keys in the rolling two-week editor window. */
  openDayKeys: string[];
  /** How many past day blocks were flipped to logged on this load. */
  loggedDayCount: number;
  /** Wireframe print freeze cue (Fri 11:59pm ET). */
  printFreezeLabel: string;
}

/** Agenda payload safe to pass into Client Components. */
export interface FamilyMeetingAgendaView
  extends Omit<FamilyMeetingAgenda, "groups"> {
  groups: FamilyMeetingGroupAgendaView[];
}

/** Drop RegExp nameMatchers so the agenda can cross the RSC → client boundary. */
export function toClientFamilyMeetingAgenda(
  agenda: FamilyMeetingAgenda
): FamilyMeetingAgendaView {
  return {
    ...agenda,
    groups: agenda.groups.map((lane) => ({
      calendarName: lane.calendarName,
      events: lane.events,
      missingCalendar: lane.missingCalendar,
      group: {
        id: lane.group.id,
        label: lane.group.label,
        shortLabel: lane.group.shortLabel,
        accent: lane.group.accent,
        ink: lane.group.ink,
      },
    })),
  };
}

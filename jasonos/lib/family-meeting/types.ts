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

export type FamilyMeetingPresentation = "auto" | "spotlight" | "routine";

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
}

export interface FamilyMeetingGroupAgenda {
  group: FamilyCalendarGroup;
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

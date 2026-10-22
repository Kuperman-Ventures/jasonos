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
}

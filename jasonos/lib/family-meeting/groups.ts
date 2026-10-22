import type { FamilyCalendarGroup, FamilyCalendarGroupId } from "./types";

/** People-group calendars that feed the weekend Family Meeting agenda. */
export const FAMILY_CALENDAR_GROUPS: FamilyCalendarGroup[] = [
  {
    id: "family",
    label: "Family",
    shortLabel: "Family",
    nameMatchers: [/^family$/i, /\bfamily\b/i],
    accent: "#d4a84b",
    ink: "#2a1f0a",
  },
  {
    id: "kat_jason",
    label: "Kat & Jason",
    shortLabel: "Kat & Jason",
    nameMatchers: [
      /^kat\s*[&+and]+\s*jason$/i,
      /^jason\s*[&+and]+\s*kat$/i,
      /\bkat\s*[&+and]+\s*jason\b/i,
    ],
    accent: "#c4796a",
    ink: "#2a1210",
  },
  {
    id: "kyle_kat_jason",
    label: "Kyle, Kat & Jason",
    shortLabel: "Kyle",
    nameMatchers: [/\bkyle\b/i],
    accent: "#4a9b8c",
    ink: "#0d221f",
  },
  {
    id: "wyatt_kat_jason",
    label: "Wyatt, Kat & Jason",
    shortLabel: "Wyatt",
    nameMatchers: [/\bwyatt\b/i],
    accent: "#6a8fbf",
    ink: "#101824",
  },
];

const BY_ID = new Map(FAMILY_CALENDAR_GROUPS.map((g) => [g.id, g]));

export function familyCalendarGroup(
  id: FamilyCalendarGroupId
): FamilyCalendarGroup {
  const group = BY_ID.get(id);
  if (!group) throw new Error(`unknown family calendar group: ${id}`);
  return group;
}

/**
 * Assign a calendar display name to one people-group.
 * More specific names (Kyle / Wyatt) win before Family / Kat & Jason.
 */
export function matchCalendarGroup(
  calendarName: string
): FamilyCalendarGroup | null {
  const name = calendarName.trim();
  if (!name) return null;

  const ordered: FamilyCalendarGroupId[] = [
    "kyle_kat_jason",
    "wyatt_kat_jason",
    "kat_jason",
    "family",
  ];

  for (const id of ordered) {
    const group = familyCalendarGroup(id);
    if (group.nameMatchers.some((re) => re.test(name))) return group;
  }
  return null;
}

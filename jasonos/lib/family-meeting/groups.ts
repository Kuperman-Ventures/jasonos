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
      /^kat\s*(?:&|and|\+)\s*jason$/i,
      /^jason\s*(?:&|and|\+)\s*kat$/i,
      /\bkat\s*(?:&|and|\+)\s*jason\b/i,
    ],
    accent: "#c4796a",
    ink: "#2a1210",
  },
  {
    id: "kyle_kat_jason",
    label: "Kyle, Kat & Jason",
    shortLabel: "Kyle",
    nameMatchers: [/^kyle$/i, /\bkyle\b/i],
    accent: "#4a9b8c",
    ink: "#0d221f",
  },
  {
    id: "wyatt_kat_jason",
    label: "Wyatt, Kat & Jason",
    shortLabel: "Wyatt",
    nameMatchers: [/^wyatt$/i, /\bwyatt\b/i],
    accent: "#6a8fbf",
    ink: "#101824",
  },
];

const BY_ID = new Map(FAMILY_CALENDAR_GROUPS.map((g) => [g.id, g]));

/** Strip emoji / variation selectors so "Family ⚠️" → "Family". */
export function normalizeCalendarName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\uFE0F/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function familyCalendarGroup(
  id: FamilyCalendarGroupId
): FamilyCalendarGroup {
  const group = BY_ID.get(id);
  if (!group) throw new Error(`unknown family calendar group: ${id}`);
  return group;
}

/**
 * Score how well a calendar name fits a group. Higher is better.
 * Exact / short names beat broader contains matches (Family vs Kuperman Family).
 */
export function scoreCalendarGroupMatch(
  calendarName: string,
  group: FamilyCalendarGroup
): number {
  const raw = calendarName.trim();
  const name = normalizeCalendarName(raw);
  if (!name) return 0;

  if (group.id === "family") {
    if (/^family$/i.test(name)) return 100;
    if (/^kuperman\s+family$/i.test(name)) return 80;
    if (/\bfamily\b/i.test(name)) return 40;
    return 0;
  }

  if (group.id === "kat_jason") {
    if (/^kat\s*(?:&|and|\+)\s*jason$/i.test(name)) return 100;
    if (/^jason\s*(?:&|and|\+)\s*kat$/i.test(name)) return 100;
    if (/\bkat\s*(?:&|and|\+)\s*jason\b/i.test(name)) return 60;
    return 0;
  }

  if (group.id === "kyle_kat_jason") {
    if (/^kyle$/i.test(name)) return 100;
    if (/^kyle\b/i.test(name) && /kat|jason/i.test(name)) return 90;
    if (/\bkyle\b/i.test(name)) return 50;
    return 0;
  }

  if (group.id === "wyatt_kat_jason") {
    if (/^wyatt$/i.test(name)) return 100;
    if (/^wyatt\b/i.test(name) && /kat|jason/i.test(name)) return 90;
    if (/\bwyatt\b/i.test(name)) return 50;
    return 0;
  }

  return group.nameMatchers.some((re) => re.test(name)) ? 10 : 0;
}

/**
 * Assign a calendar display name to one people-group.
 * More specific names (Kyle / Wyatt) win before Family / Kat & Jason.
 */
export function matchCalendarGroup(
  calendarName: string
): FamilyCalendarGroup | null {
  const ordered: FamilyCalendarGroupId[] = [
    "kyle_kat_jason",
    "wyatt_kat_jason",
    "kat_jason",
    "family",
  ];

  let best: { group: FamilyCalendarGroup; score: number } | null = null;
  for (const id of ordered) {
    const group = familyCalendarGroup(id);
    const score = scoreCalendarGroupMatch(calendarName, group);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { group, score };
  }
  return best?.group ?? null;
}

/** Among calendars competing for the same group, pick the strongest name match. */
export function pickBestCalendarForGroup(
  group: FamilyCalendarGroup,
  calendars: { name: string; href: string }[]
): { name: string; href: string } | null {
  let best: { name: string; href: string; score: number } | null = null;
  for (const cal of calendars) {
    const score = scoreCalendarGroupMatch(cal.name, group);
    if (score <= 0) continue;
    if (!best || score > best.score) {
      best = { ...cal, score };
    }
  }
  return best ? { name: best.name, href: best.href } : null;
}

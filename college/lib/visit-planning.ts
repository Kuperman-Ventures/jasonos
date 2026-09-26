/**
 * Visit planning: cluster list schools around the school being viewed.
 * Drive times are not available yet (no maps API) — legs use place labels only.
 */

import { interestRank, type InterestLevel, type School } from "@/lib/types";
import { listPhaseById, type ListPhaseId } from "@/lib/list-phases";

export type VisitInterestKey = InterestLevel | "none";

export type VisitStop = {
  schoolId: string;
  /** Label between this stop and the previous one (no invented minutes). */
  driveFromPrev: string | null;
};

export type VisitSlot = {
  time: string;
  schoolId: string | null;
  title: string;
  sub?: string;
  icon?: "car" | "meal";
};

export type VisitCluster = {
  id: "same" | "plus1" | "long";
  name: string;
  sub: string;
  days: number;
  stops: VisitStop[];
  note: string;
  plan: VisitSlot[][];
};

export type VisitTripMeta = {
  name: string;
  window: string;
  /** YYYY-MM-DD suggested start */
  start: string;
};

export type ParsedLocation = {
  city: string;
  state: string;
  label: string;
};

const INTEREST_CHIP_LABEL: Record<VisitInterestKey, string> = {
  top: "Top choice",
  high: "High interest",
  moderate: "Moderate interest",
  safety: "Safety / backup",
  "": "Not on list",
  none: "Not on list",
};

export function visitInterestKey(level: InterestLevel | undefined): VisitInterestKey {
  if (!level) return "none";
  return level;
}

export function visitInterestLabel(level: InterestLevel | undefined): string {
  return INTEREST_CHIP_LABEL[visitInterestKey(level)];
}

export function parseSchoolLocation(location: string): ParsedLocation {
  const trimmed = location.trim();
  const comma = trimmed.lastIndexOf(",");
  if (comma === -1) {
    return { city: trimmed, state: "", label: trimmed || "Campus area" };
  }
  const city = trimmed.slice(0, comma).trim();
  const state = trimmed.slice(comma + 1).trim();
  return {
    city,
    state,
    label: state ? `${city}, ${state}` : city || trimmed,
  };
}

function shortName(name: string): string {
  const paren = name.match(/\(([^)]+)\)/);
  if (paren?.[1]) return paren[1].trim();
  const dash = name.split(/[–—]/)[0]?.trim();
  if (dash && dash.length > 0 && dash.length < name.length) return dash;
  return name.replace(/\s+University$/i, "").trim() || name;
}

function sortByInterestThenName(a: School, b: School): number {
  const rank = interestRank(a.interestLevel) - interestRank(b.interestLevel);
  if (rank !== 0) return rank;
  return a.name.localeCompare(b.name);
}

function buildDayPlan(
  base: School,
  ordered: School[],
  mode: "same" | "plus1" | "long",
): VisitSlot[] {
  const slots: VisitSlot[] = [];
  let hour = 9;
  ordered.forEach((school, index) => {
    if (index > 0) {
      const prev = ordered[index - 1]!;
      const leg =
        mode === "same"
          ? "Nearby"
          : mode === "plus1"
            ? "Same state"
            : "Regional";
      slots.push({
        time: `${hour}:00`,
        schoolId: null,
        title: `Drive · ${leg}`,
        sub: `${shortName(prev.name)} → ${shortName(school.name)}`,
        icon: "car",
      });
      hour += 1;
    }
    if (index === 1 && ordered.length > 2) {
      slots.push({
        time: "12:30",
        schoolId: null,
        title: "Lunch",
        sub: "Between campuses",
        icon: "meal",
      });
      hour = 14;
    }
    const isHere = school.id === base.id;
    slots.push({
      time: `${String(Math.min(hour, 16)).padStart(2, "0")}:00`,
      schoolId: school.id,
      title: isHere ? `${shortName(school.name)} campus visit` : `${shortName(school.name)} tour`,
      sub: isHere ? "This school" : "Placeholder until booked",
    });
    hour += 2;
  });
  return slots;
}

function stopsFromOrdered(
  ordered: School[],
  mode: "same" | "plus1" | "long",
): VisitStop[] {
  return ordered.map((school, index) => ({
    schoolId: school.id,
    driveFromPrev:
      index === 0
        ? null
        : mode === "same"
          ? "nearby"
          : mode === "plus1"
            ? "same state"
            : "regional",
  }));
}

/** Suggest visit clusters around `base` using list schools' City, ST locations. */
export function buildVisitClusters(base: School, listSchools: School[]): VisitCluster[] {
  const live = listSchools.filter((school) => !school.archived);
  const here = parseSchoolLocation(base.location);
  const others = live.filter((school) => school.id !== base.id);

  const sameCity = others
    .filter((school) => {
      const loc = parseSchoolLocation(school.location);
      return (
        loc.state &&
        loc.state === here.state &&
        loc.city.toLowerCase() === here.city.toLowerCase()
      );
    })
    .sort(sortByInterestThenName);

  const sameState = others
    .filter((school) => {
      const loc = parseSchoolLocation(school.location);
      if (!here.state || loc.state !== here.state) return false;
      return loc.city.toLowerCase() !== here.city.toLowerCase();
    })
    .sort(sortByInterestThenName);

  const used = new Set([base.id, ...sameCity.map((s) => s.id), ...sameState.map((s) => s.id)]);
  const farther = others
    .filter((school) => !used.has(school.id))
    .sort(sortByInterestThenName)
    .slice(0, 4);

  const clusters: VisitCluster[] = [];

  const sameDayOrdered = [base, ...sameCity];
  clusters.push({
    id: "same",
    name: "Same day",
    sub: here.city ? `${here.city} area` : "Local campus",
    days: 1,
    stops: stopsFromOrdered(sameDayOrdered, "same"),
    note:
      sameCity.length > 0
        ? `Other list schools in ${here.city || "this city"}. Drive times TBD until a maps source is wired.`
        : `Start with ${shortName(base.name)}. No other list schools share this city yet.`,
    plan: [buildDayPlan(base, sameDayOrdered, "same")],
  });

  if (sameState.length > 0) {
    const plusOrdered = [base, ...sameState.slice(0, 4)];
    clusters.push({
      id: "plus1",
      name: "+1 day",
      sub: here.state ? `${here.state} campuses` : "Nearby state",
      days: 1,
      stops: stopsFromOrdered(plusOrdered, "plus1"),
      note: `Same-state list schools. Order is by interest; drive times are placeholders.`,
      plan: [buildDayPlan(base, plusOrdered, "plus1")],
    });
  }

  if (farther.length > 0) {
    const longOrdered = [base, ...farther];
    const days = farther.length > 2 ? 2 : 1;
    const plan: VisitSlot[][] =
      days === 2
        ? [
            buildDayPlan(base, [base, farther[0]!], "long"),
            buildDayPlan(base, farther.slice(1), "long"),
          ]
        : [buildDayPlan(base, longOrdered, "long")];
    clusters.push({
      id: "long",
      name: "Longer trip",
      sub: "Beyond this state",
      days,
      stops: stopsFromOrdered(longOrdered, "long"),
      note: "Higher-interest schools farther out. Compare on one trip once drive times are available.",
      plan,
    });
  }

  return clusters;
}

export function buildVisitTripMeta(
  base: School,
  listPhaseId: ListPhaseId,
  processPhaseLabel: string | null,
): VisitTripMeta {
  const loc = parseSchoolLocation(base.location);
  const listPhase = listPhaseById(listPhaseId);
  const windowParts = [
    processPhaseLabel || listPhase.season,
    listPhase.window.split("–")[0]?.trim() || "",
  ].filter(Boolean);
  const name = loc.state
    ? `${loc.state} visit · ${shortName(base.name)}`
    : `${shortName(base.name)} visit`;
  return {
    name,
    window: windowParts.join(" · "),
    start: listPhase.startsOn,
  };
}

export function schoolMapById(schools: School[]): Map<string, School> {
  return new Map(schools.map((school) => [school.id, school]));
}

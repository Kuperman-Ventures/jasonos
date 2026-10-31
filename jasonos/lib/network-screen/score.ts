import { isBucket, isLane, isTier, type Bucket, type Lane, type Tier } from "./types";

export type ScoreInput = {
  linkedinDegree: string | null;
  bucket: string;
  tier: string;
  title: string | null;
  company: string | null;
  why: string | null;
  ask: string | null;
  nextAction: string | null;
};

export type ScoreResult = {
  bucket: Bucket;
  tier: Tier;
  title: string | null;
  company: string | null;
  why: string | null;
  ask: string | null;
  nextAction: string | null;
};

const REACTIVATE = "Reactivate directly";

export const INTRO_RECOMMENDATION_LIMIT = 3;

export type ClassifiedPick = {
  id: string;
  lane: string;
  tier: string;
  bucket: string;
  title: string | null;
  company: string | null;
  why: string | null;
  ask: string | null;
};

export type ClassifiedCandidate = {
  id: string;
  lane: Lane;
  bucket: Bucket;
  tier: Tier;
  title: string | null;
  company: string | null;
  why: string | null;
  ask: string | null;
  nextAction: string | null;
};

function blank(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Rules the model is told, applied again in code before anything is saved. */
function bucketKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s/]+/g, "_").replace(/_+/g, "_");
}

function tierKey(value: string): string {
  const key = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (key === "1" || key === "tier1") return "tier1";
  if (key === "2" || key === "tier2") return "tier2";
  if (key === "none" || key === "0") return "none";
  return key;
}

function laneKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s/]+/g, "_").replace(/_+/g, "_");
}

export function applyScoreRules(input: ScoreInput): ScoreResult {
  const tierText = tierKey(input.tier);
  let tier: Tier = isTier(tierText) ? tierText : "none";
  let nextAction = blank(input.nextAction);
  const firstDegree = input.linkedinDegree === "1st";
  if (firstDegree) {
    tier = "tier2";
    nextAction = REACTIVATE;
  }
  const why = tier === "tier1" || tier === "tier2" ? blank(input.why) : null;
  const ask = tier === "tier1" ? blank(input.ask) : null;
  return {
    bucket: (() => {
      const key = bucketKey(input.bucket);
      return isBucket(key) && key !== "unscored" ? key : "not_relevant";
    })(),
    tier,
    title: blank(input.title),
    company: blank(input.company),
    why,
    ask,
    nextAction,
  };
}

/** Classify every captured person from the model picks. Cap tier1 at three. */
export function classifyCandidates(
  people: { id: string; linkedinDegree: string | null }[],
  picks: ClassifiedPick[]
): ClassifiedCandidate[] {
  const byId = new Map(people.map((person) => [person.id, person]));
  const classified = new Map<string, ClassifiedCandidate>();
  const tier1Order: string[] = [];

  for (const pick of picks) {
    if (!pick.id || !byId.has(pick.id) || classified.has(pick.id)) continue;
    const person = byId.get(pick.id)!;
    const scored = applyScoreRules({
      linkedinDegree: person.linkedinDegree,
      bucket: pick.bucket,
      tier: pick.tier,
      title: pick.title,
      company: pick.company,
      why: pick.why,
      ask: pick.ask,
      nextAction: pick.tier === "tier1" ? "Ask for the intro" : null,
    });
    const laneText = laneKey(pick.lane);
    let lane: Lane = isLane(laneText) ? laneText : "none";
    let tier = scored.tier;
    let why = scored.why;
    let ask = scored.ask;
    let nextAction = scored.nextAction;

    if (lane === "none" || lane === "unassigned") {
      lane = "none";
      tier = "none";
      why = null;
      ask = null;
      if (person.linkedinDegree !== "1st") nextAction = null;
    } else if (tier === "tier1" && (!why || !ask)) {
      tier = "tier2";
      ask = null;
      if (person.linkedinDegree !== "1st") nextAction = null;
    }

    if (tier === "tier1") tier1Order.push(pick.id);

    classified.set(pick.id, {
      id: pick.id,
      lane,
      bucket: lane === "none" ? "not_relevant" : scored.bucket,
      tier,
      title: scored.title,
      company: scored.company,
      why,
      ask,
      nextAction,
    });
  }

  let keptTier1 = 0;
  for (const id of tier1Order) {
    const row = classified.get(id);
    if (!row || row.tier !== "tier1") continue;
    keptTier1 += 1;
    if (keptTier1 > INTRO_RECOMMENDATION_LIMIT) {
      row.tier = "tier2";
      row.ask = null;
      if (byId.get(id)?.linkedinDegree !== "1st") row.nextAction = null;
    }
  }

  for (const person of people) {
    if (classified.has(person.id)) continue;
    classified.set(person.id, {
      id: person.id,
      lane: "none",
      bucket: "not_relevant",
      tier: "none",
      title: null,
      company: null,
      why: null,
      ask: null,
      nextAction: person.linkedinDegree === "1st" ? REACTIVATE : null,
    });
  }

  const ordered: ClassifiedCandidate[] = [];
  for (const pick of picks) {
    const row = classified.get(pick.id);
    if (row && !ordered.some((entry) => entry.id === row.id)) ordered.push(row);
  }
  for (const person of people) {
    const row = classified.get(person.id);
    if (row && !ordered.some((entry) => entry.id === row.id)) ordered.push(row);
  }
  return ordered;
}

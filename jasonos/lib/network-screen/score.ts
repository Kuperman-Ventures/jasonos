import { isBucket, isTier, type Bucket, type Tier } from "./types";

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

export type IntroPick = {
  id: string;
  bucket: string;
  title: string | null;
  company: string | null;
  why: string | null;
  ask: string | null;
};

export type IntroRecommendation = {
  id: string;
  bucket: Bucket;
  tier: "tier1";
  title: string | null;
  company: string | null;
  why: string;
  ask: string;
  nextAction: string;
};

/** Keep the model's picks that are real intro targets, in the order given, capped at three. */
export function selectIntroRecommendations(
  people: { id: string; linkedinDegree: string | null }[],
  picks: IntroPick[]
): IntroRecommendation[] {
  const degrees = new Map(people.map((person) => [person.id, person.linkedinDegree]));
  const chosen: IntroRecommendation[] = [];
  const seen = new Set<string>();
  for (const pick of picks) {
    if (!pick.id || seen.has(pick.id) || !degrees.has(pick.id)) continue;
    seen.add(pick.id);
    const scored = applyScoreRules({
      linkedinDegree: degrees.get(pick.id) ?? null,
      bucket: pick.bucket,
      tier: "tier1",
      title: pick.title,
      company: pick.company,
      why: pick.why,
      ask: pick.ask,
      nextAction: "Ask for the intro",
    });
    if (scored.tier !== "tier1" || !scored.why || !scored.ask) continue;
    chosen.push({
      id: pick.id,
      bucket: scored.bucket,
      tier: "tier1",
      title: scored.title,
      company: scored.company,
      why: scored.why,
      ask: scored.ask,
      nextAction: "Ask for the intro",
    });
    if (chosen.length === INTRO_RECOMMENDATION_LIMIT) break;
  }
  return chosen;
}

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

export function applyScoreRules(input: ScoreInput): ScoreResult {
  const tierText = tierKey(input.tier);
  let tier: Tier = isTier(tierText) ? tierText : "none";
  let nextAction = blank(input.nextAction);
  const firstDegree = input.linkedinDegree === "1st";
  if (firstDegree) {
    tier = "tier2";
    nextAction = REACTIVATE;
  }
  const why = tier === "tier1" ? blank(input.why) : null;
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

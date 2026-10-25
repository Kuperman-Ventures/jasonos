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

import type { Bucket, NetworkScreenCandidate, NetworkScreenDetail } from "./types";

const BUCKET_RANK: Record<Bucket, number> = {
  hiring_path: 0,
  recruiter: 1,
  peer_referral: 2,
  prospect: 3,
  operating_partner: 4,
  speaking_content: 5,
  industry_peer: 6,
  not_relevant: 7,
  unscored: 8,
};

export function blurbWordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Tier 1 people the intro-request email actually asks the connector to introduce. */
export function peopleInTheAsk(screen: NetworkScreenDetail): NetworkScreenCandidate[] {
  const tier1 = screen.candidates
    .filter((person) => person.tier === "tier1")
    .sort(
      (a, b) => BUCKET_RANK[a.bucket] - BUCKET_RANK[b.bucket] || a.sortOrder - b.sortOrder
    );
  if (screen.relationshipWarmth === "warm" || screen.relationshipWarmth === "expecting_review") {
    return tier1;
  }
  return tier1.slice(0, 1);
}

export function buildEmailBodyWithBlurbs(screen: NetworkScreenDetail): string {
  const body = screen.draftBody ?? "";
  if (!screen.includeBlurbsInEmail) return body;
  const blocks = peopleInTheAsk(screen).flatMap((person) => {
    const blurb = person.introBlurb?.trim();
    if (!blurb) return [];
    return [`${person.name}:\n${blurb}`];
  });
  if (!blocks.length) return body;
  return `${body}\n\nTo make this easy, here is a note you can forward for each person. Edit anything that does not sound like you.\n\n${blocks.join("\n\n")}`;
}

import type { NetworkScreenCandidate, NetworkScreenDetail } from "./types";

export function blurbWordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Tier 1 people the intro-request email asks the connector to introduce (all three). */
export function peopleInTheAsk(screen: NetworkScreenDetail): NetworkScreenCandidate[] {
  return screen.candidates
    .filter((person) => person.tier === "tier1")
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 3);
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

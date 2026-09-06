import type { GuideDefinition, GuideId } from "./types";

export const DEFAULT_GUIDE_ID: GuideId = "guide";

export const GUIDES: Record<GuideId, GuideDefinition> = {
  guide: {
    id: "guide",
    name: "The Guide",
    tagline: "Clear, curious, and improbably prepared.",
    status: "available",
    unavailableMessage: "",
    avatarDescription:
      "Abstract field-guide sigil: a soft star nested in an open book shape with a thin orbit line.",
    theme: {
      accent: "var(--iugr-accent)",
      glow: "var(--iugr-glow-accent)",
      panel: "var(--iugr-panel)",
    },
  },
  mira: {
    id: "mira",
    name: "Mira",
    tagline: "Curious explorer mode. Arriving from a nearby future.",
    status: "coming-soon",
    unavailableMessage:
      "Mira is preparing her field notes. Check back after several entirely normal temporal events.",
    avatarDescription:
      "Soft explorer sigil: a crescent path circling a small planet.",
    theme: {
      accent: "var(--iugr-violet)",
      glow: "var(--iugr-glow-violet)",
      panel: "var(--iugr-panel)",
    },
  },
  "dr-maybe": {
    id: "dr-maybe",
    name: "Dr. Maybe",
    tagline: "Careful skeptic mode. Currently checking the footnotes.",
    status: "coming-soon",
    unavailableMessage:
      "Dr. Maybe has requested one additional piece of evidence. This may take a while.",
    avatarDescription:
      "Skeptic sigil: a magnifying circle resting over a careful question mark.",
    theme: {
      accent: "var(--iugr-coral)",
      glow: "var(--iugr-glow-coral)",
      panel: "var(--iugr-panel)",
    },
  },
};

export const GUIDE_ORDER: GuideId[] = ["guide", "mira", "dr-maybe"];

export function getGuide(id: GuideId): GuideDefinition {
  return GUIDES[id] ?? GUIDES.guide;
}

/** Prefer a guide-specific line; fall back to The Guide when missing. */
export function guideLine(
  guideId: GuideId,
  lines: Partial<Record<GuideId, string>> & { guide: string },
): string {
  const specific = lines[guideId];
  if (typeof specific === "string" && specific.trim().length > 0) {
    return specific;
  }
  return lines.guide;
}

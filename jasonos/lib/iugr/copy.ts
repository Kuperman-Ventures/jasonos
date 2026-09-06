import type { GuideId } from "./types";
import { guideLine } from "./guides";

export const SERIES = {
  name: "The Improbably Useful Guide to Reality",
  shortName: "IUGR",
  pronunciation: "Eye-Ew-Gurr",
  libraryLabel: "The IUGR Library",
} as const;

export const EPISTEMIC = {
  pill: "Thought experiment · not proof",
  dialogTitle: "About this entry",
  dialogBody:
    "This entry explains a philosophical argument. It does not present evidence that our universe is simulated.",
} as const;

export const GUIDE_SETTINGS = {
  heading: "Adjust Your Guide",
  subheading: "Different guides, same inconveniently large questions.",
  voicesNote:
    "Guide voices alter the route’s commentary, not the underlying claims.",
  detailLabel: "Detail level",
  detailOptions: [
    { id: "story" as const, label: "Story first" },
    { id: "balanced" as const, label: "Balanced" },
    { id: "machinery" as const, label: "Show me the machinery" },
  ],
} as const;

export const OVERFLOW = {
  sources: "Sources (coming soon)",
  restart: "Restart entry",
  reducedMotion: "Reduce motion",
  highContrast: "High contrast (preview)",
} as const;

export function stageAside(guideId: GuideId): string {
  return guideLine(guideId, {
    guide:
      "Stay with the argument. Curiosity is allowed. Certainty is on a short leash.",
    mira: "Pack light. Ask loud questions. Leave the footnotes for later — for now.",
    "dr-maybe":
      "Interesting claim. Let us see what it needs before we believe it.",
  });
}

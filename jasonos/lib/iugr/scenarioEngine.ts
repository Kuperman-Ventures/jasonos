/**
 * Assumption Arcade scenario engine.
 *
 * Qualitative-only evaluation of a made-up town scenario.
 * Never emits probabilities, odds, confidence scores, or claims about
 * whether the reader (or our universe) is simulated.
 */

import { ARCADE_SCRIPT } from "./script";

export type CivilizationReach = "rarely" | "sometimes" | "often";
export type ConsciousnessStance = "no" | "unknown" | "yes";
export type ComputeScale = "tiny" | "huge" | "absurdly-huge";
export type HistoryInterest = "almost-never" | "sometimes" | "constantly";
export type SimulationDetail = "sketches" | "local-detail" | "full-worlds";

export type ScenarioAssumptions = {
  civilizations: CivilizationReach;
  consciousness: ConsciousnessStance;
  compute: ComputeScale;
  history: HistoryInterest;
  detail: SimulationDetail;
};

export type ScenarioCategory =
  | "copies-stay-rare"
  | "mixed-or-uncertain"
  | "copies-could-outnumber"
  | "observer-count-breaks"
  | "too-uncertain-to-count";

export type ScenarioReadingId =
  | "copies-stay-rare"
  | "will-not-settle"
  | "count-breaks"
  | "copies-win";

export type ScenarioEvaluation = {
  category: ScenarioCategory;
  readingId: ScenarioReadingId;
  label: string;
  explanation: string;
  /** Plain-language notes naming which assumptions did the work. */
  whatDidTheWork: string[];
  /** Longer optional reasoning for the disclosure panel. */
  reasoning: string[];
};

export const DEFAULT_SCENARIO_ASSUMPTIONS: ScenarioAssumptions = {
  civilizations: "sometimes",
  consciousness: "unknown",
  compute: "huge",
  history: "sometimes",
  detail: "local-detail",
};

function readingForCategory(category: ScenarioCategory): ScenarioReadingId {
  if (category === "observer-count-breaks") return "count-breaks";
  if (category === "copies-could-outnumber") return "copies-win";
  if (
    category === "too-uncertain-to-count" ||
    category === "mixed-or-uncertain"
  ) {
    return "will-not-settle";
  }
  return "copies-stay-rare";
}

export const SCENARIO_CATEGORY_LABELS: Record<ScenarioCategory, string> = {
  "copies-stay-rare": ARCADE_SCRIPT.readings["copies-stay-rare"].label,
  "mixed-or-uncertain": ARCADE_SCRIPT.readings["will-not-settle"].label,
  "copies-could-outnumber": ARCADE_SCRIPT.readings["copies-win"].label,
  "observer-count-breaks": ARCADE_SCRIPT.readings["count-breaks"].label,
  "too-uncertain-to-count": ARCADE_SCRIPT.readings["will-not-settle"].label,
};

const EXPLANATIONS: Record<ScenarioReadingId, string> = {
  "copies-stay-rare": ARCADE_SCRIPT.readings["copies-stay-rare"].body,
  "will-not-settle": ARCADE_SCRIPT.readings["will-not-settle"].body,
  "count-breaks": ARCADE_SCRIPT.readings["count-breaks"].body,
  "copies-win": ARCADE_SCRIPT.readings["copies-win"].body,
};

function isClearlyLowScale(a: ScenarioAssumptions): boolean {
  return (
    a.civilizations === "rarely" ||
    a.history === "almost-never" ||
    a.compute === "tiny"
  );
}

function isHighScaleForOutnumber(a: ScenarioAssumptions): boolean {
  return (
    a.consciousness === "yes" &&
    a.civilizations === "often" &&
    (a.compute === "huge" || a.compute === "absurdly-huge") &&
    a.history === "constantly" &&
    (a.detail === "local-detail" || a.detail === "full-worlds")
  );
}

function workNotes(
  a: ScenarioAssumptions,
  category: ScenarioCategory,
): string[] {
  const notes: string[] = [];

  if (category === "observer-count-breaks") {
    notes.push("Copied mind set to “No.”");
    return notes;
  }

  if (a.consciousness === "unknown") {
    notes.push("Copied mind left as “Unknown.”");
  }
  if (a.civilizations === "rarely") {
    notes.push("Civilisations get that far only “Rarely.”");
  }
  if (a.history === "almost-never") {
    notes.push("They choose to build these “Almost never.”");
  }
  if (a.compute === "tiny") {
    notes.push("Available computing power set to “Tiny.”");
  }
  if (category === "copies-could-outnumber") {
    notes.push("Civilisations get that far “Often.”");
    notes.push("Copied mind set to “Yes.”");
    notes.push(
      a.compute === "absurdly-huge"
        ? "Computing power set to “Absurdly huge.”"
        : "Computing power set to “Huge.”",
    );
    notes.push("They choose to build these “Constantly.”");
  }
  if (category === "mixed-or-uncertain" && notes.length === 0) {
    if (a.civilizations === "sometimes") {
      notes.push("Civilisations get that far only “Sometimes.”");
    }
    if (a.history === "sometimes") {
      notes.push("Interest in building set to “Sometimes.”");
    }
  }
  if (notes.length === 0) {
    notes.push("Several settings pull in different directions.");
  }
  return notes;
}

function reasoningLines(
  a: ScenarioAssumptions,
  readingId: ScenarioReadingId,
): string[] {
  const lines: string[] = [];

  if (readingId === "count-breaks") {
    lines.push(
      "If a copied mind is not a mind, there is nothing inside the copies to count.",
    );
  } else if (readingId === "will-not-settle") {
    lines.push(
      "An open mind question leaves everything downstream unsettled.",
    );
  } else if (readingId === "copies-stay-rare") {
    lines.push(
      "At least one bottleneck keeps large numbers of conscious copies from lining up in this setting.",
    );
  } else {
    lines.push(
      "All three dials lean hard enough that copies of you outnumber originals in this setting.",
    );
  }

  lines.push(
    `Current dials: civilizations=${a.civilizations}, consciousness=${a.consciousness}, history=${a.history}.`,
  );
  return lines;
}

/**
 * Evaluate a qualitative scenario. Never returns a probability or personal odds.
 */
export function evaluateScenario(
  assumptions: ScenarioAssumptions,
): ScenarioEvaluation {
  let category: ScenarioCategory;

  if (assumptions.consciousness === "no") {
    category = "observer-count-breaks";
  } else if (assumptions.consciousness === "unknown") {
    category = isClearlyLowScale(assumptions)
      ? "copies-stay-rare"
      : "too-uncertain-to-count";
  } else if (isClearlyLowScale(assumptions)) {
    category = "copies-stay-rare";
  } else if (isHighScaleForOutnumber(assumptions)) {
    category = "copies-could-outnumber";
  } else if (
    assumptions.detail === "sketches" &&
    assumptions.history === "sometimes"
  ) {
    category = "too-uncertain-to-count";
  } else {
    category = "mixed-or-uncertain";
  }

  const readingId = readingForCategory(category);

  return {
    category,
    readingId,
    label: ARCADE_SCRIPT.readings[readingId].label,
    explanation: EXPLANATIONS[readingId],
    whatDidTheWork: workNotes(assumptions, category),
    reasoning: reasoningLines(assumptions, readingId),
  };
}

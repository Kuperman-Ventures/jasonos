/**
 * Copy Machine return-visit scenario engine (three dials).
 *
 * Qualitative-only. Never emits probabilities, odds, confidence scores,
 * percentages, or claims that the reader is or is not simulated.
 */

import { ARCADE_SCRIPT } from "./script";

export type CivilizationReach = "rarely" | "sometimes" | "often";
export type ConsciousnessStance = "no" | "unknown" | "yes";
export type HistoryInterest = "almost-never" | "sometimes" | "constantly";

export type ScenarioAssumptions = {
  civilizations: CivilizationReach;
  history: HistoryInterest;
  consciousness: ConsciousnessStance;
};

export type ScenarioReadingId =
  | "copies-stay-rare"
  | "will-not-settle"
  | "count-breaks"
  | "copies-win";

/** Kept as an alias of the reading for existing CSS hooks. */
export type ScenarioCategory = ScenarioReadingId;

export type ScenarioEvaluation = {
  category: ScenarioCategory;
  readingId: ScenarioReadingId;
  label: string;
  explanation: string;
  /** Plain-language notes naming which dial settings drove the reading. */
  whatDidTheWork: string[];
};

export const DEFAULT_SCENARIO_ASSUMPTIONS: ScenarioAssumptions = {
  civilizations: "sometimes",
  history: "sometimes",
  consciousness: "unknown",
};

export const CIVILIZATION_VALUES: CivilizationReach[] = [
  "rarely",
  "sometimes",
  "often",
];

export const HISTORY_VALUES: HistoryInterest[] = [
  "almost-never",
  "sometimes",
  "constantly",
];

export const CONSCIOUSNESS_VALUES: ConsciousnessStance[] = [
  "no",
  "unknown",
  "yes",
];

const REACH_LABEL: Record<CivilizationReach, string> = {
  rarely: "Rarely",
  sometimes: "Sometimes",
  often: "Often",
};

const BUILD_LABEL: Record<HistoryInterest, string> = {
  "almost-never": "Almost never",
  sometimes: "Sometimes",
  constantly: "Constantly",
};

const MIND_LABEL: Record<ConsciousnessStance, string> = {
  no: "No",
  unknown: "Unknown",
  yes: "Yes",
};

function resolveReadingId(a: ScenarioAssumptions): ScenarioReadingId {
  const mind = a.consciousness;
  const reach = a.civilizations;
  const build = a.history;

  if (mind === "no") return "count-breaks";

  if (mind === "unknown") {
    if (reach === "rarely" || build === "almost-never") {
      return "copies-stay-rare";
    }
    return "will-not-settle";
  }

  // mind === "yes"
  if (reach === "often" && build === "constantly") return "copies-win";
  if (reach === "rarely" || build === "almost-never") return "copies-stay-rare";
  return "will-not-settle";
}

function workNotes(
  a: ScenarioAssumptions,
  readingId: ScenarioReadingId,
): string[] {
  const notes: string[] = [];

  if (readingId === "count-breaks") {
    notes.push(`Copied mind set to “${MIND_LABEL[a.consciousness]}.”`);
    return notes;
  }

  if (readingId === "copies-win") {
    notes.push(`Civilizations get that far “${REACH_LABEL[a.civilizations]}.”`);
    notes.push(`They choose to build these “${BUILD_LABEL[a.history]}.”`);
    notes.push(`Copied mind set to “${MIND_LABEL[a.consciousness]}.”`);
    return notes;
  }

  if (readingId === "copies-stay-rare") {
    if (a.civilizations === "rarely") {
      notes.push(`Civilizations get that far only “${REACH_LABEL.rarely}.”`);
    }
    if (a.history === "almost-never") {
      notes.push(
        `They choose to build these “${BUILD_LABEL["almost-never"]}.”`,
      );
    }
    if (a.consciousness === "unknown") {
      notes.push(`Copied mind left as “${MIND_LABEL.unknown}.”`);
    } else if (a.consciousness === "yes") {
      notes.push(`Copied mind set to “${MIND_LABEL.yes}.”`);
    }
    if (notes.length === 0) {
      notes.push("An upstream dial keeps copies rare in this setting.");
    }
    return notes;
  }

  // will-not-settle
  if (a.consciousness === "unknown") {
    notes.push(`Copied mind left as “${MIND_LABEL.unknown}.”`);
  }
  if (a.civilizations === "sometimes") {
    notes.push(`Civilizations get that far only “${REACH_LABEL.sometimes}.”`);
  }
  if (a.history === "sometimes") {
    notes.push(`They choose to build these “${BUILD_LABEL.sometimes}.”`);
  }
  if (a.consciousness === "yes" && notes.length === 0) {
    notes.push(
      "The dials do not all lean hard enough for copies to win, and nothing upstream shuts the tap off.",
    );
  }
  if (notes.length === 0) {
    notes.push("Several settings leave the count unsettled.");
  }
  return notes;
}

/**
 * Evaluate a qualitative three-dial scenario.
 * Never returns a probability, percentage, or personal odds.
 */
export function evaluateScenario(
  assumptions: ScenarioAssumptions,
): ScenarioEvaluation {
  const readingId = resolveReadingId(assumptions);
  const reading = ARCADE_SCRIPT.readings[readingId];

  return {
    category: readingId,
    readingId,
    label: reading.label,
    explanation: reading.body,
    whatDidTheWork: workNotes(assumptions, readingId),
  };
}

/** All 27 dial combinations for exhaustive tests. */
export function allScenarioCombinations(): ScenarioAssumptions[] {
  const out: ScenarioAssumptions[] = [];
  for (const civilizations of CIVILIZATION_VALUES) {
    for (const history of HISTORY_VALUES) {
      for (const consciousness of CONSCIOUSNESS_VALUES) {
        out.push({ civilizations, history, consciousness });
      }
    }
  }
  return out;
}

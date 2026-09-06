/**
 * Assumption Arcade scenario engine.
 *
 * Qualitative-only evaluation of a made-up town scenario.
 * Never emits probabilities, odds, confidence scores, or claims about
 * whether the reader (or our universe) is simulated.
 */

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

export type ScenarioEvaluation = {
  category: ScenarioCategory;
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

export const SCENARIO_CATEGORY_LABELS: Record<ScenarioCategory, string> = {
  "copies-stay-rare": "Copies probably stay rare in this scenario.",
  "mixed-or-uncertain":
    "Original and copied observers could be similarly common, or the scenario is too uncertain to count cleanly.",
  "copies-could-outnumber":
    "Copied observers could outnumber original observers in this scenario.",
  "observer-count-breaks": "The observer count may not work in this scenario.",
  "too-uncertain-to-count": "This scenario is too uncertain to count cleanly.",
};

const EXPLANATIONS: Record<ScenarioCategory, string> = {
  "copies-stay-rare":
    "Under these assumptions, the conditions needed for huge numbers of conscious copies do not line up. Copied observers would probably stay rare in this scenario.",
  "observer-count-breaks":
    "You selected that simulated minds do not have inner experience. If that is true, copied residents may not belong in the observer count at all, so the central counting step cannot get started.",
  "too-uncertain-to-count":
    "You marked a key premise as unknown. That is honest: without knowing whether simulations can contain conscious minds, the counting argument cannot produce a clean conclusion.",
  "mixed-or-uncertain":
    "Some conditions support many copies, while others limit them. In this scenario, original and copied observers might be similarly common, or the unknowns may prevent a clean count.",
  "copies-could-outnumber":
    "Under this particular high-scale scenario, conscious copied observers could outnumber original observers. That is the condition that gives the simulation argument its force, not proof that this condition exists in reality.",
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
    notes.push("Conscious simulated minds set to “No.”");
    return notes;
  }

  if (a.consciousness === "unknown") {
    notes.push("Conscious simulated minds left as “Unknown.”");
  }
  if (a.civilizations === "rarely") {
    notes.push("Civilizations reach the far future only “Rarely.”");
  }
  if (a.history === "almost-never") {
    notes.push("Future people make history copies “Almost never.”");
  }
  if (a.compute === "tiny") {
    notes.push("Available computing power set to “Tiny.”");
  }
  if (category === "copies-could-outnumber") {
    notes.push("Civilizations reach the far future “Often.”");
    notes.push("Conscious simulated minds set to “Yes.”");
    notes.push(
      a.compute === "absurdly-huge"
        ? "Computing power set to “Absurdly huge.”"
        : "Computing power set to “Huge.”",
    );
    notes.push("Future people make history copies “Constantly.”");
    notes.push(
      a.detail === "full-worlds"
        ? "Simulation detail set to “Full worlds.”"
        : "Simulation detail set to “Local detail.”",
    );
  }
  if (category === "mixed-or-uncertain" && notes.length === 0) {
    if (a.civilizations === "sometimes") {
      notes.push("Civilizations reach the far future only “Sometimes.”");
    }
    if (a.history === "sometimes") {
      notes.push("Interest in history copies set to “Sometimes.”");
    }
    if (a.detail === "sketches") {
      notes.push("Simulation detail set to “Sketches.”");
    }
    if (a.consciousness === "yes") {
      notes.push(
        "Conscious simulated minds set to “Yes,” but scale settings stay mixed.",
      );
    }
  }
  if (notes.length === 0) {
    notes.push("Several settings pull in different directions.");
  }
  return notes;
}

function reasoningLines(
  a: ScenarioAssumptions,
  category: ScenarioCategory,
): string[] {
  const lines: string[] = [
    "This console only rearranges assumptions. It never measures our universe.",
  ];

  if (category === "observer-count-breaks") {
    lines.push(
      "If copied minds lack inner experience, they may not belong in an observer count, so the Copy Machine’s arithmetic cannot carry the philosophical argument.",
    );
  } else if (category === "too-uncertain-to-count") {
    lines.push(
      "An unknown about consciousness leaves the counting step without a clear population to count.",
    );
  } else if (category === "copies-stay-rare") {
    lines.push(
      "At least one bottleneck (reach, motivation, or compute) keeps large numbers of conscious copies from lining up in this scenario.",
    );
  } else if (category === "copies-could-outnumber") {
    lines.push(
      "Only when reach, consciousness, compute, motivation, and detail all lean high does the “copies could outnumber originals” branch open, and even then it remains a conditional scenario, not a finding.",
    );
  } else {
    lines.push(
      "Mixed settings can support either modest copy counts or unresolved uncertainty; the console refuses to invent a single clean tally.",
    );
  }

  lines.push(
    `Current levers: civilizations=${a.civilizations}, consciousness=${a.consciousness}, compute=${a.compute}, history=${a.history}, detail=${a.detail}.`,
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

  return {
    category,
    label: SCENARIO_CATEGORY_LABELS[category],
    explanation: EXPLANATIONS[category],
    whatDidTheWork: workNotes(assumptions, category),
    reasoning: reasoningLines(assumptions, category),
  };
}

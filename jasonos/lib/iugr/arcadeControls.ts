import type {
  CivilizationReach,
  ConsciousnessStance,
  ComputeScale,
  HistoryInterest,
  ScenarioAssumptions,
  SimulationDetail,
} from "./scenarioEngine";
import { ARCADE_SCRIPT } from "./script";

export type ArcadeControlId = keyof ScenarioAssumptions;

export type ArcadeOption<T extends string> = {
  id: T;
  label: string;
};

export type ArcadeControlDef =
  | {
      id: "civilizations";
      title: string;
      explanation: string;
      whyItMatters: string;
      aside: string;
      options: ArcadeOption<CivilizationReach>[];
    }
  | {
      id: "consciousness";
      title: string;
      explanation: string;
      whyItMatters: string;
      aside: string;
      options: ArcadeOption<ConsciousnessStance>[];
    }
  | {
      id: "compute";
      title: string;
      explanation: string;
      whyItMatters: string;
      aside: string;
      options: ArcadeOption<ComputeScale>[];
    }
  | {
      id: "history";
      title: string;
      explanation: string;
      whyItMatters: string;
      aside: string;
      options: ArcadeOption<HistoryInterest>[];
    }
  | {
      id: "detail";
      title: string;
      explanation: string;
      whyItMatters: string;
      aside: string;
      options: ArcadeOption<SimulationDetail>[];
    };

export const ASSUMPTION_ARCADE = {
  chapterLabel: "Chapter · Back To The Machine",
  title: "Back To The Machine",
  welcome: ARCADE_SCRIPT.intro[0],
  welcomeAside: "",
  bridgeFromDoors: "",
  outcomeTitle: "Reading",
  whatDidTheWorkTitle: "What did the work?",
  showReasoning: "Show the reasoning",
  hideReasoning: "Hide the reasoning",
  tryAnother: "Try a different setting. Change any dial above.",
  bridgeNext: "",
  continueLabel: ARCADE_SCRIPT.continueLabel,
  previousLabel: "Previous",
  consoleAria: "Assumption dials",
  outcomeAria: "Scenario reading",
} as const;

/** Beat 5 dials first; compute/detail kept for the engine, shown after. */
export const ARCADE_CONTROLS: ArcadeControlDef[] = [
  {
    id: "civilizations",
    title: ARCADE_SCRIPT.dials.civilizations.title,
    explanation: "",
    whyItMatters: "",
    aside: "",
    options: [...ARCADE_SCRIPT.dials.civilizations.options],
  },
  {
    id: "history",
    title: ARCADE_SCRIPT.dials.history.title,
    explanation: "",
    whyItMatters: "",
    aside: "",
    options: [...ARCADE_SCRIPT.dials.history.options],
  },
  {
    id: "consciousness",
    title: ARCADE_SCRIPT.dials.consciousness.title,
    explanation: "",
    whyItMatters: "",
    aside: "",
    options: [...ARCADE_SCRIPT.dials.consciousness.options],
  },
  {
    id: "compute",
    title: "How much computing power exists?",
    explanation: "",
    whyItMatters: "",
    aside: "",
    options: [
      { id: "tiny", label: "Tiny" },
      { id: "huge", label: "Huge" },
      { id: "absurdly-huge", label: "Absurdly huge" },
    ],
  },
  {
    id: "detail",
    title: "How detailed are the copies?",
    explanation: "",
    whyItMatters: "",
    aside: "",
    options: [
      { id: "sketches", label: "Sketches" },
      { id: "local-detail", label: "Local detail" },
      { id: "full-worlds", label: "Full worlds" },
    ],
  },
];

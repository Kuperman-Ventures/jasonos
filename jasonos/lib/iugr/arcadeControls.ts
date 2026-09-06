import type {
  CivilizationReach,
  ConsciousnessStance,
  ComputeScale,
  HistoryInterest,
  ScenarioAssumptions,
  SimulationDetail,
} from "./scenarioEngine";

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
  chapterLabel: "Chapter · Assumption Arcade",
  title: "Assumption Arcade",
  welcome: "Welcome to the Assumption Arcade.",
  welcomeAside:
    "No arcade tokens required. Only opinions about the distant future, consciousness, and rather a lot of imaginary computing power.",
  bridgeFromDoors:
    "The Copy Machine showed what happens if copies become numerous. The Three Doors showed why that might never happen. Now you can adjust the assumptions. Not to solve reality, but to see which assumptions do the work.",
  outcomeTitle: "Scenario Field Note",
  whatDidTheWorkTitle: "What did the work?",
  showReasoning: "Show the reasoning",
  hideReasoning: "Hide the reasoning",
  tryAnother: "Try a different scenario. Change any control above.",
  bridgeNext:
    "You have now met the assumptions. Next, let’s inspect some things people often mistake for evidence.",
  continueLabel: "Scan the Claims",
  previousLabel: "Previous",
  consoleAria: "Assumption Arcade scenario console",
  outcomeAria: "Scenario field note",
} as const;

export const ARCADE_CONTROLS: ArcadeControlDef[] = [
  {
    id: "civilizations",
    title: "Do civilizations reach the far future?",
    explanation:
      "How often would a civilization survive, keep advancing, and gain the ability to run extremely detailed simulations?",
    whyItMatters:
      "If almost nobody reaches that point, there may be few or no advanced simulators.",
    aside: "Long-term planning is difficult even when the plan does not involve galaxies.",
    options: [
      { id: "rarely", label: "Rarely" },
      { id: "sometimes", label: "Sometimes" },
      { id: "often", label: "Often" },
    ],
  },
  {
    id: "consciousness",
    title: "Can a simulated mind have an inner life?",
    explanation:
      "Would a very advanced simulation create someone who truly experiences thoughts and feelings, or only something that behaves as if it does?",
    whyItMatters:
      "The copy-counting argument works only if copied beings count as conscious observers.",
    aside: "Convincing behavior and actual experience are annoyingly hard to separate.",
    options: [
      { id: "no", label: "No" },
      { id: "unknown", label: "Unknown" },
      { id: "yes", label: "Yes" },
    ],
  },
  {
    id: "compute",
    title: "How much computing power exists?",
    explanation:
      "How many detailed worlds could advanced civilizations realistically run?",
    whyItMatters:
      "More usable computation could allow more simulations, but the true cost of simulating minds or worlds is unknown.",
    aside:
      "“Absurdly huge” is the official technical unit for quantities that make spreadsheets nervous.",
    options: [
      { id: "tiny", label: "Tiny" },
      { id: "huge", label: "Huge" },
      { id: "absurdly-huge", label: "Absurdly huge" },
    ],
  },
  {
    id: "history",
    title: "Do future people make history copies?",
    explanation:
      "Even if they can run simulations, would future people choose to create many detailed versions of their distant past?",
    whyItMatters:
      "Capability is not motivation. Future people may have different values, rules, ethics, or hobbies.",
    aside: "Having an archive does not require reopening every Tuesday.",
    options: [
      { id: "almost-never", label: "Almost never" },
      { id: "sometimes", label: "Sometimes" },
      { id: "constantly", label: "Constantly" },
    ],
  },
  {
    id: "detail",
    title: "How detailed are the copies?",
    explanation:
      "Would simulations be rough models, detailed only where it matters, or richly consistent worlds?",
    whyItMatters:
      "Higher detail may require more resources. It also does not automatically settle whether a simulated mind is conscious.",
    aside: "Reality has an unreasonable number of corners.",
    options: [
      { id: "sketches", label: "Sketches" },
      { id: "local-detail", label: "Local detail" },
      { id: "full-worlds", label: "Full worlds" },
    ],
  },
];

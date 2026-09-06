import type {
  CivilizationReach,
  ConsciousnessStance,
  HistoryInterest,
  ScenarioAssumptions,
} from "./scenarioEngine";
import { ARCADE_SCRIPT } from "./script";

export type MachineDialId = keyof ScenarioAssumptions;

export type MachineDialOption<T extends string> = {
  id: T;
  label: string;
};

export type MachineDialDef =
  | {
      id: "civilizations";
      title: string;
      options: MachineDialOption<CivilizationReach>[];
    }
  | {
      id: "history";
      title: string;
      options: MachineDialOption<HistoryInterest>[];
    }
  | {
      id: "consciousness";
      title: string;
      options: MachineDialOption<ConsciousnessStance>[];
    };

export const MACHINE_RETURN = {
  chapterLabel: "Chapter · Back To The Machine",
  title: "Back To The Machine",
  welcome: ARCADE_SCRIPT.intro[0],
  outcomeTitle: "Reading",
  whatDidTheWorkTitle: "What did the work?",
  tryAnother: "Try a different setting. Change any dial above.",
  continueLabel: ARCADE_SCRIPT.continueLabel,
  previousLabel: "Previous",
  dialsAria: "Scenario dials",
  outcomeAria: "Scenario reading",
  challengeUnsettled: ARCADE_SCRIPT.challengeFindUnsettled,
  challengeCopiesWin: ARCADE_SCRIPT.challengeFindCopiesWin,
} as const;

/** Three dials only — compute and detail removed. */
export const MACHINE_DIALS: MachineDialDef[] = [
  {
    id: "civilizations",
    title: ARCADE_SCRIPT.dials.civilizations.title,
    options: [...ARCADE_SCRIPT.dials.civilizations.options],
  },
  {
    id: "history",
    title: ARCADE_SCRIPT.dials.history.title,
    options: [...ARCADE_SCRIPT.dials.history.options],
  },
  {
    id: "consciousness",
    title: ARCADE_SCRIPT.dials.consciousness.title,
    options: [...ARCADE_SCRIPT.dials.consciousness.options],
  },
];

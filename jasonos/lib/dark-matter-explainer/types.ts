export type LaneColorKey = "j1" | "j2" | "a" | "f" | "b";

export type Stop = {
  worldIndex: number;
  tokens: string[];
  note: string;
  dashedFromPrevious: boolean;
  dashedLeadIn: boolean;
};

export type Lane = {
  colorKey: LaneColorKey;
  label: string;
  sublabel: string;
  stops: Stop[];
};

export type World = {
  number: number;
  firstVisibleStep: number;
  title: string;
  subtitle: string;
  cast: string[];
  description: string;
  hue: number;
};

export type SeasonData = {
  captions: string[];
  worlds: World[];
  lanes: Lane[];
};

export type ExplainerData = {
  tokenFormat: string;
  characters: Record<string, string>;
  ringColors: Record<string, string>;
  laneColors: Record<LaneColorKey, string>;
  season1: SeasonData;
  season2: SeasonData;
};

export type TokenView = {
  letter: string;
  version: string;
  name: string;
  ring: string;
  portrait: string | null;
};

export type CellView = {
  opacity: number;
  left: string;
  right: string;
  glow: string;
  hasStop: boolean;
  tokens: TokenView[];
  note: string;
};

export type WorldColumnView = {
  index: number;
  number: number;
  title: string;
  subtitle: string;
  visible: boolean;
  selected: boolean;
  glow: string;
  top: string;
  border: string;
  accent: string;
  cells: CellView[];
};

export type LaneLabelView = {
  index: number;
  colorKey: LaneColorKey;
  label: string;
  sublabel: string;
  color: string;
  active: boolean;
};

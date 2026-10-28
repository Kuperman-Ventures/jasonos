import dataJson from "./data.json";
import type {
  CellView,
  ExplainerData,
  LaneColorKey,
  LaneLabelView,
  SeasonData,
  TokenView,
  WorldColumnView,
} from "./types";

export const EXPLAINER = dataJson as ExplainerData;

export function seasonData(season: 1 | 2): SeasonData {
  return season === 1 ? EXPLAINER.season1 : EXPLAINER.season2;
}

export function clampStep(season: 1 | 2, step: number): number {
  const max = seasonData(season).captions.length - 1;
  return Math.max(0, Math.min(max, step));
}

export function parseToken(token: string, portraits: Record<string, string> = {}): TokenView {
  const letter = token[0] ?? "";
  const version = token.slice(1);
  const base = EXPLAINER.characters[letter] ?? letter;
  const suffix =
    version === "*"
      ? " (variant)"
      : version === "X"
        ? " (World X)"
        : /^\d+$/.test(version)
          ? ` ${version}`
          : version
            ? ` ${version}`
            : "";
  return {
    letter,
    version,
    name: `${base}${suffix}`,
    ring: EXPLAINER.ringColors[letter] ?? "#8fa3aa",
    portrait: portraits[letter] ?? null,
  };
}

function dash(color: string): string {
  return `repeating-linear-gradient(90deg,${color} 0 8px,transparent 8px 15px)`;
}

function hsl(hue: number, sat: number, light: number, alpha: number): string {
  return `hsla(${hue},${sat}%,${light}%,${alpha})`;
}

type GridCell = {
  left: string | null;
  right: string | null;
  stop: SeasonData["lanes"][number]["stops"][number] | null;
};

function buildGrid(season: SeasonData, step: number): GridCell[][] {
  const grid: GridCell[][] = season.worlds.map(() =>
    season.lanes.map(() => ({ left: null, right: null, stop: null })),
  );

  season.lanes.forEach((lane, laneIndex) => {
    const color = EXPLAINER.laneColors[lane.colorKey];
    lane.stops.forEach((stop, stopIndex) => {
      const world = season.worlds[stop.worldIndex];
      if (!world) return;
      if (world.firstVisibleStep <= step) grid[stop.worldIndex][laneIndex].stop = stop;
      if (stop.dashedLeadIn && world.firstVisibleStep <= step) {
        grid[stop.worldIndex][laneIndex].left = dash(color);
      }
      if (stopIndex === 0) return;
      const previousCol = lane.stops[stopIndex - 1]?.worldIndex;
      if (previousCol == null) return;
      const lo = Math.min(previousCol, stop.worldIndex);
      const hi = Math.max(previousCol, stop.worldIndex);
      const loWorld = season.worlds[lo];
      const hiWorld = season.worlds[hi];
      if (!loWorld || !hiWorld) return;
      if (hiWorld.firstVisibleStep > step || loWorld.firstVisibleStep > step) return;
      const fill = stop.dashedFromPrevious ? dash(color) : color;
      for (let col = lo; col <= hi; col += 1) {
        if (col > lo) grid[col][laneIndex].left = fill;
        if (col < hi) grid[col][laneIndex].right = fill;
      }
    });
  });

  return grid;
}

export function selectedWorldIndex(
  season: SeasonData,
  step: number,
  manual: number | null,
): number {
  if (manual != null && season.worlds[manual]) return manual;
  const visible = season.worlds
    .map((world, index) => (world.firstVisibleStep <= step ? index : -1))
    .filter((index) => index >= 0);
  return visible[visible.length - 1] ?? 0;
}

export function buildExplainerView(input: {
  season: 1 | 2;
  step: number;
  trace: "all" | LaneColorKey;
  selectedWorld: number | null;
  portraits?: Record<string, string>;
}): {
  captions: string[];
  step: number;
  maxStep: number;
  caption: string;
  minWidth: number;
  worlds: WorldColumnView[];
  lanes: LaneLabelView[];
  selected: {
    title: string;
    subtitle: string;
    description: string;
    accent: string;
    glow: string;
    cast: TokenView[];
  };
} {
  const season = seasonData(input.season);
  const maxStep = Math.max(0, season.captions.length - 1);
  const step = Math.min(input.step, maxStep);
  const grid = buildGrid(season, step);
  const selected = selectedWorldIndex(season, step, input.selectedWorld);
  const portraits = input.portraits ?? {};

  const worlds: WorldColumnView[] = season.worlds.map((world, worldIndex) => {
    const visible = world.firstVisibleStep <= step;
    const on = worldIndex === selected;
    const sat = world.hue === 0 ? 0 : 65;
    const cells: CellView[] = season.lanes.map((lane, laneIndex) => {
      const cell = grid[worldIndex][laneIndex];
      const dim = !(input.trace === "all" || input.trace === lane.colorKey);
      const tokens = cell.stop ? cell.stop.tokens.map((token) => parseToken(token, portraits)) : [];
      return {
        opacity: dim ? 0.14 : 1,
        left: cell.left ?? "transparent",
        right: cell.right ?? "transparent",
        glow: EXPLAINER.laneColors[lane.colorKey],
        hasStop: Boolean(cell.stop),
        tokens,
        note: cell.stop?.note ?? "",
      };
    });
    return {
      index: worldIndex,
      number: world.number,
      title: world.title,
      subtitle: world.subtitle,
      visible,
      selected: on,
      glow: hsl(world.hue, sat, on ? 30 : 18, on ? 0.55 : 0.3),
      top: hsl(world.hue, sat, on ? 40 : 28, on ? 0.6 : 0.32),
      border: on ? hsl(world.hue, sat + 10, 62, 0.9) : "rgba(255,255,255,.14)",
      accent: hsl(world.hue, sat + 15, 72, 1),
      cells,
    };
  });

  const selectedWorld = season.worlds[selected] ?? season.worlds[0];
  if (!selectedWorld) {
    throw new Error("Dark Matter explainer is missing world data");
  }
  const selectedSat = selectedWorld.hue === 0 ? 0 : 65;

  return {
    captions: season.captions,
    step,
    maxStep,
    caption: season.captions[step] ?? "",
    minWidth: 190 + season.worlds.length * 142,
    worlds,
    lanes: season.lanes.map((lane, index) => ({
      index,
      colorKey: lane.colorKey,
      label: lane.label,
      sublabel: lane.sublabel,
      color: EXPLAINER.laneColors[lane.colorKey],
      active: input.trace === "all" || input.trace === lane.colorKey,
    })),
    selected: {
      title: selectedWorld.title,
      subtitle: selectedWorld.subtitle,
      description: selectedWorld.description,
      accent: hsl(selectedWorld.hue, selectedSat + 15, 72, 1),
      glow: hsl(selectedWorld.hue, selectedSat, 24, 0.5),
      cast: selectedWorld.cast.map((token) => parseToken(token, portraits)),
    },
  };
}

export const CHARACTER_ROSTER = Object.keys(EXPLAINER.characters);

export type Age = "second" | "third";

export type Tale =
  | "hobbit"
  | "fellowship"
  | "two-towers"
  | "return-of-the-king"
  | "rop-s1"
  | "rop-s2";

export type Region = {
  id: string;
  name: string;
  viewBox: string;
  path: string;
};

export type Scene = {
  tale: Tale;
  title: string;
  text: string;
  source: string;
};

export type Location = {
  id: string;
  regionId: string;
  x: number;
  y: number;
  names: { second?: string; third?: string };
  summary: string;
  scenes: Scene[];
};

export const TALE_AGE: Record<Tale, Age> = {
  hobbit: "third",
  fellowship: "third",
  "two-towers": "third",
  "return-of-the-king": "third",
  "rop-s1": "second",
  "rop-s2": "second",
};

export const TALE_LABEL: Record<Tale, string> = {
  hobbit: "The Hobbit",
  fellowship: "Fellowship",
  "two-towers": "Two Towers",
  "return-of-the-king": "Return of the King",
  "rop-s1": "Rings of Power S1",
  "rop-s2": "Rings of Power S2",
};

export const TALE_ORDER: Tale[] = [
  "rop-s1",
  "rop-s2",
  "hobbit",
  "fellowship",
  "two-towers",
  "return-of-the-king",
];

export const TALES_BY_AGE: Record<Age, Tale[]> = {
  second: ["rop-s1", "rop-s2"],
  third: ["hobbit", "fellowship", "two-towers", "return-of-the-king"],
};

export const WHOLE_VIEW_BOX = "0 0 1000 760";

export function locationName(location: Location, age: Age): string | null {
  return location.names[age] ?? null;
}

export function locationInAge(location: Location, age: Age): boolean {
  if (!location.names[age]) return false;
  return location.scenes.some((scene) => TALE_AGE[scene.tale] === age);
}

export function scenesInAge(location: Location, age: Age): Scene[] {
  return location.scenes.filter((scene) => TALE_AGE[scene.tale] === age);
}

export function scenesForTales(location: Location, age: Age, tales: Set<Tale>): Scene[] {
  return scenesInAge(location, age).filter((scene) => tales.has(scene.tale));
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

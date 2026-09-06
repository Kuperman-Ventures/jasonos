/**
 * Three Doors chapter — Bostrom-style simulation-argument trilemma as a
 * thought-experiment hub. Content is illustrative philosophy, not evidence.
 */

export type DoorId = "road-ends" | "archive-closed" | "copy-warehouse";

export type DoorDefinition = {
  id: DoorId;
  number: 1 | 2 | 3;
  label: string;
  title: string;
  concept: string;
  support: string;
  aside: string;
  takeaway: string;
  /** Extra optional disclosure; may include proper-name attribution. */
  fieldNote: string;
  /** Door 3 only — explicit unmet assumptions. */
  caveat?: string;
  accentVar: "--iugr-door-1" | "--iugr-door-2" | "--iugr-door-3";
};

export const THREE_DOOR_IDS: DoorId[] = [
  "road-ends",
  "archive-closed",
  "copy-warehouse",
];

export const THREE_DOORS_DATA: Record<DoorId, DoorDefinition> = {
  "road-ends": {
    id: "road-ends",
    number: 1,
    label: "DOOR 1",
    title: "The Road Ends Early",
    concept:
      "Maybe civilizations rarely survive long enough, or develop enough capability, to make enormous numbers of detailed conscious simulations.",
    support:
      "They might collapse, stop advancing, choose another path, or find that the needed technology is much harder than expected.",
    aside: "Civilization is a remarkably difficult group project.",
    takeaway:
      "If almost nobody gets that far, there may be few or no ancestor-style simulations to count.",
    fieldNote:
      "This door covers extinction, stagnation, and “too hard” futures. It does not claim any of those outcomes are guaranteed. Only that if they are common, the later counting argument never starts.",
    accentVar: "--iugr-door-1",
  },
  "archive-closed": {
    id: "archive-closed",
    number: 2,
    label: "DOOR 2",
    title: "The Archive Is Closed",
    concept:
      "Maybe advanced civilizations exist and could make simulations, but they do not create huge numbers of detailed historical worlds like ours.",
    support:
      "They might find it too expensive, ethically uncomfortable, illegal, unnecessary, or less interesting than whatever people do in the far future.",
    aside:
      "Having a very large computer does not automatically create a very large desire to reenact 2026.",
    takeaway:
      "If future people rarely run these simulations, copied observers may remain rare.",
    fieldNote:
      "Capability is not the same as appetite. A closed archive can be a choice, a law, a cost, or a shrug. Not a prison.",
    accentVar: "--iugr-door-2",
  },
  "copy-warehouse": {
    id: "copy-warehouse",
    number: 3,
    label: "DOOR 3",
    title: "The Copy Warehouse",
    concept:
      "Maybe advanced civilizations can make conscious simulations and choose to make enormous numbers of them.",
    support:
      "If that happened, there could be many more copied observers than original observers. That is where the counting idea from Original Town becomes important.",
    aside:
      "At this scale, even an ordinary town can become an alarming amount of paperwork.",
    takeaway:
      "Only under those assumptions could copied observers outnumber originals.",
    caveat:
      "This door depends on big unanswered assumptions: that conscious simulated minds are possible, that the simulations are affordable, and that future people would choose to make many.",
    fieldNote:
      "Door 3 is not a prediction. It is the branch of the argument where the Original Town counting story would matter if those assumptions hold.",
    accentVar: "--iugr-door-3",
  },
};

export function allDoorsExplored(explored: readonly DoorId[]): boolean {
  return THREE_DOOR_IDS.every((id) => explored.includes(id));
}

export function markDoorExplored(
  explored: readonly DoorId[],
  id: DoorId,
): DoorId[] {
  if (explored.includes(id)) return [...explored];
  return [...explored, id];
}

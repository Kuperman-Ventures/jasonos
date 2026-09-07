import type { CopySnapPoint } from "@/lib/iugr/scenarioMath";
import { COPY_SNAP_POINTS } from "@/lib/iugr/scenarioMath";

/** Lever knob cy on the apparatus track for each snap. */
export const LEVER_CY: Record<CopySnapPoint, number> = {
  0: 78,
  1: 65,
  9: 52,
  99: 39,
  999: 26,
};

export const APPARATUS = {
  viewBox: "0 0 300 118",
  dialCx: 79,
  dialCy: 42,
  dialNeedleLength: 9,
  leverCx: 228,
  leverKnobR: 8.5,
  dialNeedleAngleAt0: -90,
  dialNeedleAngleAt999: 90,
} as const;

export const COPY_BODY: Record<CopySnapPoint, string> = {
  0: "One lever. It does exactly one thing, and the thing it does is arithmetic.",
  1: "One copy and it is already even. You did not have to work very hard for that.",
  9: "Nine copies. Pick a resident at random and nine times out of ten you land in a copy.",
  99: "Ninety-nine copies. Ninety-nine times out of a hundred you land in a copy.",
  999: "The lever stops here. The arithmetic does not.",
};

export const COPY_BODY_UNSURE_SECOND =
  "You left the mind question open. The count runs, but it does not settle anything.";

export const COPY_BODY_NO =
  "You said copies are not people. The machine still makes them. It just has nothing to count.";

export const CHALLENGE = {
  openLabel: "CHALLENGE",
  openText: "Pull the lever until the copies outnumber the originals.",
  evenLabel: "CHALLENGE - EVEN, NOT YET A MAJORITY",
  evenText: "Pull the lever until the copies outnumber the originals.",
  completeLabel: "CHALLENGE COMPLETE",
  completeText: "Copies of you now outnumber the originals.",
  unavailableLabel: "CHALLENGE UNAVAILABLE UNDER YOUR ANSWER",
  unavailableText: "Change your answer in Original Town, or carry on.",
} as const;

export const PLATE_CAPTIONS = {
  apparatus: "The apparatus",
  count: "The count",
  field100: "1 dot = 1 town · 100 towns",
  field1000: "1 dot = 1 town · 1,000 towns",
} as const;

export const COUNT_ROW = {
  originals: "ORIGINALS",
  copies: "COPIES",
  copiedShare: "COPIED SHARE",
} as const;

export const SILENT_SCREEN = {
  line1: "One of these is you.",
  line2: "The other 999 are also certain they are you.",
  tap: "TAP ANYWHERE",
} as const;

export const CONTINUE_LABEL = "Meet the Three Doors";

/** Page wash accent by copy count. */
export function washAccentForCopies(copiedTowns: number): string {
  if (copiedTowns <= 0) return "rgba(139,134,217,0.10)";
  if (copiedTowns === 1) return "rgba(232,131,111,0.10)";
  if (copiedTowns === 9) return "rgba(232,131,111,0.13)";
  return "rgba(232,131,111,0.16)";
}

export function snapIndex(copiedTowns: number): number {
  const idx = COPY_SNAP_POINTS.indexOf(copiedTowns as CopySnapPoint);
  return idx >= 0 ? idx : 0;
}

/** Advance one detent; wraps 999 → 0. */
export function nextSnapPoint(copiedTowns: number): CopySnapPoint {
  const snap = COPY_SNAP_POINTS.includes(copiedTowns as CopySnapPoint)
    ? (copiedTowns as CopySnapPoint)
    : nearestSnap(copiedTowns);
  const idx = COPY_SNAP_POINTS.indexOf(snap);
  return COPY_SNAP_POINTS[(idx + 1) % COPY_SNAP_POINTS.length]!;
}

export function leverCyForCount(copiedTowns: number): number {
  const snap = COPY_SNAP_POINTS.includes(copiedTowns as CopySnapPoint)
    ? (copiedTowns as CopySnapPoint)
    : nearestSnap(copiedTowns);
  return LEVER_CY[snap];
}

export function nearestSnap(rawYOrCount: number): CopySnapPoint {
  let best: CopySnapPoint = 0;
  let bestDist = Infinity;
  for (const p of COPY_SNAP_POINTS) {
    const d = Math.abs(p - rawYOrCount);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

/** Map a pointer Y in SVG viewBox space to the nearest lever detent. */
export function nearestSnapFromLeverCy(cy: number): CopySnapPoint {
  let best: CopySnapPoint = 0;
  let bestDist = Infinity;
  for (const p of COPY_SNAP_POINTS) {
    const d = Math.abs(LEVER_CY[p] - cy);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

export function dialNeedleAngle(copiedTowns: number): number {
  const t = Math.max(0, Math.min(1, copiedTowns / 999));
  return (
    APPARATUS.dialNeedleAngleAt0 +
    t * (APPARATUS.dialNeedleAngleAt999 - APPARATUS.dialNeedleAngleAt0)
  );
}

export function formatCopiedShareLabel(copiedTowns: number): string {
  if (copiedTowns <= 0) return "0%";
  if (copiedTowns === 1) return "50%";
  if (copiedTowns === 9) return "90%";
  if (copiedTowns === 99) return "99%";
  if (copiedTowns === 999) return "99.9%";
  const share = copiedTowns / (1 + copiedTowns);
  const pct = share * 100;
  if (pct >= 99.5 && pct < 100) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

export function copiesPeopleCount(copiedTowns: number): number {
  return copiedTowns * 100;
}

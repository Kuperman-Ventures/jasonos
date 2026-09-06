/**
 * IUGR motion system. Three tiers, reused by every chapter.
 *
 * Tier 1 idle: always on, barely visible. No more than 1.5px / 1deg.
 * Tier 2 response: fires on reader action, 150–400ms, starts within 50ms.
 * Tier 3 transition: chapter changes only, 300–500ms, directional, once.
 *
 * Not allowed: walk cycles, bouncing, character performance, decorative
 * flourishes, or any animation the reader must wait for before continuing.
 *
 * Reduced motion:
 * - Tier 1 stops
 * - Tier 2 becomes an instant state change that still shows colour / outline
 * - Tier 3 becomes a cross-fade
 */

export const MOTION = {
  idle: {
    maxTranslatePx: 1.5,
    maxRotateDeg: 1,
    durationMs: { min: 6000, max: 12000 },
    starFieldDurationMs: 10000,
  },
  response: {
    durationMs: { min: 150, max: 400 },
    startWithinMs: 50,
    readerRingMs: 250,
    copiedFadeMs: 300,
  },
  transition: {
    durationMs: { min: 300, max: 500 },
    chapterMs: 400,
    copiedSlideMs: 350,
  },
} as const;

export type IdleMotion = {
  durationMs: number;
  delayMs: number;
};

/**
 * Deterministic idle timing from a figure index.
 * Do not use Math.random: this tree is server-rendered.
 */
export function idleMotionForIndex(index: number): IdleMotion {
  const span =
    MOTION.idle.durationMs.max - MOTION.idle.durationMs.min;
  const durationMs =
    MOTION.idle.durationMs.min + ((index * 137 + 41) % (span + 1));
  const delayMs = (index * 197 + 13) % 4000;
  return { durationMs, delayMs };
}

export function responseDurationMs(reducedMotion: boolean): number {
  return reducedMotion ? 0 : MOTION.response.readerRingMs;
}

export function transitionDurationMs(reducedMotion: boolean): number {
  return reducedMotion ? MOTION.transition.chapterMs : MOTION.transition.copiedSlideMs;
}

export function reactionSettleMs(
  reducedMotion: boolean,
  answer: "yes" | "unsure" | "no",
): number {
  if (reducedMotion) return 80;
  if (answer === "no") {
    return MOTION.transition.copiedSlideMs + MOTION.response.copiedFadeMs;
  }
  return MOTION.transition.copiedSlideMs + 50;
}

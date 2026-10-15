/**
 * Fuck You Batman plan Version 3. Week 1 starts Monday 2026-10-12.
 * Voice finished before week 1. Total 39 weeks, manuscript due 2027-07-11.
 */
import type { FybPhase } from "./types";

export const PROJECT_START = "2026-10-12";
export const TOTAL_WEEKS = 39;

export const PHASES: FybPhase[] = [
  {
    number: 1,
    name: "Voice",
    startWeek: 0,
    endWeek: 0,
    start: "2026-10-10",
    end: "2026-10-10",
    output: "Style Profile, AI Tells Checklist, two calibration rounds",
  },
  {
    number: 2,
    name: "Story foundation",
    startWeek: 1,
    endWeek: 4,
    start: "2026-10-12",
    end: "2026-11-08",
    output: "Your answers on the hero, Moon, their relationship, the detective and the tense; the Story Bible",
  },
  {
    number: 3,
    name: "Outline",
    startWeek: 5,
    endWeek: 6,
    start: "2026-11-09",
    end: "2026-11-22",
    output: "Drift Map and Scene Outline, built from your answers",
  },
  {
    number: 4,
    name: "Sample chapters",
    startWeek: 7,
    endWeek: 7,
    start: "2026-11-23",
    end: "2026-11-29",
    output: "Chapters 1-3 drafted, Style Profile checked on real prose",
  },
  {
    number: 5,
    name: "First draft",
    startWeek: 8,
    endWeek: 23,
    start: "2026-11-30",
    end: "2027-03-21",
    output: "Complete first draft, 80,000 words at 5,000 per week",
  },
  {
    number: 6,
    name: "Revision",
    startWeek: 24,
    endWeek: 33,
    start: "2027-03-22",
    end: "2027-05-30",
    output: "Five revision passes",
  },
  {
    number: 7,
    name: "Outside readers",
    startWeek: 34,
    endWeek: 37,
    start: "2027-05-31",
    end: "2027-06-27",
    output: "Reader feedback, final fixes list",
  },
  {
    number: 8,
    name: "Final polish",
    startWeek: 38,
    endWeek: 39,
    start: "2027-06-28",
    end: "2027-07-11",
    output: "Finished manuscript",
  },
];

/** YYYY-MM-DD in America/New_York. */
export function etDate(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

/** Plan week number. Week 1 is the week of PROJECT_START. Before that, 0 or negative. */
export function weekNumber(today: Date = new Date()): number {
  const todayYmd = etDate(today);
  const startMs = Date.parse(`${PROJECT_START}T12:00:00Z`);
  const todayMs = Date.parse(`${todayYmd}T12:00:00Z`);
  const days = Math.floor((todayMs - startMs) / 86_400_000);
  return Math.floor(days / 7) + 1;
}

/** Current drafting phase, or null before week 1 / after week 39. Voice is already done. */
export function currentPhase(week = weekNumber()): FybPhase | null {
  if (week < 1) return null;
  return PHASES.find((p) => p.startWeek >= 1 && week >= p.startWeek && week <= p.endWeek) ?? null;
}

export function isPhaseDone(phase: FybPhase, week = weekNumber(), todayYmd = etDate()): boolean {
  if (phase.number === 1) return todayYmd >= phase.end;
  return week > phase.endWeek;
}

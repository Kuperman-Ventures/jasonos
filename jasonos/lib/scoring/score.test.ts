import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RESORTS } from "../../config/resorts.ts";
import { SURFACE_SCORES, WEIGHTS } from "../../config/scoring.ts";
import type { DayWeather, ResortReport } from "../weather/types.ts";
import { scoreResort } from "./score.ts";

function weather(overrides: Partial<DayWeather> = {}): DayWeather {
  return {
    date: "2026-12-20",
    highF: 24,
    lowF: 20,
    windSustainedMph: 15,
    windChillF: 10,
    snowfallLast72hIn: 1,
    rainHours: 0,
    sky: "sunny",
    source: "open-meteo",
    fetchedAt: "2026-10-25T12:00:00.000Z",
    ...overrides,
  };
}

function report(trailsOpenPct: number): ResortReport {
  return {
    trailsOpenPct,
    liftsOpen: 8,
    liftsTotal: 13,
    baseDepthIn: null,
    surface: "icy",
    snowmakingActive: false,
    reportedAt: null,
    source: "stub",
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

describe("mountain rank scoring", () => {
  it("weights sum to 100", () => {
    const sum = Object.values(WEIGHTS).reduce((total, weight) => total + weight, 0);
    assert.equal(sum, 100);
  });

  it("matches the worked example raw scores within 1 point", () => {
    const original = SURFACE_SCORES.icy;
    SURFACE_SCORES.icy = 55;
    try {
      const cases = [
        // 24–29°F all sit on the flat 100 part of the temperature curve, so these
        // raw scores are 71.5, 69.4 and 68 rather than a hand total that assumes
        // warmer days score lower.
        { id: "hunter", trailsOpenPct: 70, highF: 24, windSustainedMph: 15, expected: 71.5 },
        { id: "jack-frost", trailsOpenPct: 55, highF: 26, windSustainedMph: 12, expected: 69.4 },
        { id: "mountain-creek", trailsOpenPct: 45, highF: 29, windSustainedMph: 10, expected: 68 },
      ];
      for (const item of cases) {
        const resort = RESORTS.find((candidate) => candidate.id === item.id);
        assert.ok(resort);
        const scored = scoreResort(
          resort,
          "2026-12-20",
          weather({ highF: item.highF, windSustainedMph: item.windSustainedMph }),
          report(item.trailsOpenPct)
        );
        assert.ok(
          Math.abs(round1(scored.rawScore) - item.expected) <= 1,
          `${item.id} raw ${scored.rawScore} expected ${item.expected}`
        );
      }
    } finally {
      SURFACE_SCORES.icy = original;
    }
  });

  it("gates a resort when rain lasts 4 hours", () => {
    const resort = RESORTS.find((candidate) => candidate.id === "hunter");
    assert.ok(resort);
    const scored = scoreResort(resort, "2026-01-10", weather({ date: "2026-01-10", rainHours: 4 }), report(80));
    assert.equal(scored.gate.gated, true);
    if (scored.gate.gated) {
      assert.deepEqual(scored.gate.reasons, ["Rain during ski hours"]);
    }
  });

  it("applies the holiday penalty and skips the Saturday penalty on Dec 26", () => {
    const resort = RESORTS.find((candidate) => candidate.id === "hunter");
    assert.ok(resort);
    const scored = scoreResort(resort, "2026-12-26", weather({ date: "2026-12-26" }), report(70));
    const labels = scored.adjustments.map((adjustment) => adjustment.label);
    assert.ok(labels.includes("Holiday crowd"));
    assert.equal(labels.includes("Saturday crowd"), false);
    const holiday = scored.adjustments.find((adjustment) => adjustment.label === "Holiday crowd");
    assert.equal(holiday?.points, -12);
  });
});

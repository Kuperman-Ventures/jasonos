import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  choosePrintDensity,
  lastResortPrintScale,
} from "./print-density.ts";

describe("choosePrintDensity", () => {
  it("stays at density 0 when comfortable height already fits", () => {
    const heights = [800, 900, 950, 1000, 1050, 1100, 1200];
    assert.equal(
      choosePrintDensity((d) => heights[d]!, 1000),
      0
    );
  });

  it("steps up only until the sheet fits", () => {
    // 0–2 overflow, 3 fits
    const heights = [1400, 1300, 1200, 980, 900, 850, 800];
    assert.equal(
      choosePrintDensity((d) => heights[d]!, 1000),
      3
    );
  });

  it("returns max density when nothing fits", () => {
    assert.equal(
      choosePrintDensity(() => 2000, 1000, 6),
      6
    );
  });
});

describe("lastResortPrintScale", () => {
  it("is 1 when already fitting", () => {
    assert.equal(lastResortPrintScale(900, 1000), 1);
  });

  it("scales down when still overflowing", () => {
    assert.ok(Math.abs(lastResortPrintScale(2000, 1000) - 0.5) < 0.001);
  });
});

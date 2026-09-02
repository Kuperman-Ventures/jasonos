import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  combineSuggestedScanResult,
  humanScanError,
} from "./suggested-scan.ts";

const captureOk = {
  ok: true as const,
  scanned: 400,
  created: 3,
  updated: 8,
  skipped: 12,
};

describe("combineSuggestedScanResult", () => {
  it("adds Gmail + calendar staged people to the metadata pass", () => {
    const result = combineSuggestedScanResult({
      gmail: { ok: true, candidatesStaged: 5 },
      gcal: { ok: true, candidatesStaged: 2 },
      capture: captureOk,
    });
    assert.deepEqual(result, {
      ok: true,
      scanned: 400,
      created: 10,
      updated: 8,
      skipped: 12,
    });
  });

  it("still succeeds when only the full Gmail walk found people", () => {
    const result = combineSuggestedScanResult({
      gmail: { ok: true, candidatesStaged: 4 },
      gcal: { ok: false, error: "Calendar is not connected." },
      capture: { ok: false, error: "Gmail is not connected." },
    });
    assert.deepEqual(result, {
      ok: true,
      scanned: 0,
      created: 4,
      updated: 0,
      skipped: 0,
    });
  });

  it("turns a timeout into a readable line", () => {
    assert.equal(
      humanScanError(new Error("FUNCTION_INVOCATION_TIMEOUT")),
      "Scan ran too long and was cut off. Try again."
    );
  });

  it("surfaces a real failure when nothing ran", () => {
    const result = combineSuggestedScanResult({
      gmail: { ok: false, error: "Gmail is not connected." },
      gcal: { ok: false, error: "Calendar is not connected." },
      capture: { ok: false, error: "Gmail is not connected." },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "Gmail is not connected.");
    }
  });
});

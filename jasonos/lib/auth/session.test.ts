import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  JASONOS_SESSION_MAX_AGE_MS,
  isUnlockStampFresh,
  safeNextPath,
} from "./session.ts";

describe("JasonOS unlock stamp", () => {
  it("accepts a stamp from a few minutes ago", () => {
    const now = 1_700_000_000_000;
    assert.equal(isUnlockStampFresh(String(now - 5 * 60_000), now), true);
  });

  it("rejects a stamp older than 7 days", () => {
    const now = 1_700_000_000_000;
    assert.equal(isUnlockStampFresh(String(now - JASONOS_SESSION_MAX_AGE_MS - 1), now), false);
  });

  it("rejects missing or junk stamps", () => {
    assert.equal(isUnlockStampFresh(undefined), false);
    assert.equal(isUnlockStampFresh("nope"), false);
    assert.equal(isUnlockStampFresh("-1"), false);
  });

  it("only follows in-app next paths", () => {
    assert.equal(safeNextPath("/today"), "/today");
    assert.equal(safeNextPath("https://evil.example"), "/");
    assert.equal(safeNextPath("//evil.example"), "/");
    assert.equal(safeNextPath(null), "/");
  });
});

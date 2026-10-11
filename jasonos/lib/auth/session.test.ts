import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  JASONOS_SESSION_MAX_AGE_MS,
  authCallbackUrl,
  isUnlockStampFresh,
  safeNextPath,
  unlockCookieValue,
} from "./session.ts";

describe("JasonOS unlock stamp", () => {
  it("accepts a signed stamp from a few minutes ago", async () => {
    const previous = process.env.JASONOS_UNLOCK_SECRET;
    process.env.JASONOS_UNLOCK_SECRET = "test-unlock-secret";
    try {
      const now = 1_700_000_000_000;
      const value = await unlockCookieValue(now - 5 * 60_000);
      assert.ok(value);
      assert.equal(await isUnlockStampFresh(value, now), true);
    } finally {
      if (previous === undefined) delete process.env.JASONOS_UNLOCK_SECRET;
      else process.env.JASONOS_UNLOCK_SECRET = previous;
    }
  });

  it("rejects a stamp older than 7 days", async () => {
    const previous = process.env.JASONOS_UNLOCK_SECRET;
    process.env.JASONOS_UNLOCK_SECRET = "test-unlock-secret";
    try {
      const now = 1_700_000_000_000;
      const value = await unlockCookieValue(now - JASONOS_SESSION_MAX_AGE_MS - 1);
      assert.ok(value);
      assert.equal(await isUnlockStampFresh(value, now), false);
    } finally {
      if (previous === undefined) delete process.env.JASONOS_UNLOCK_SECRET;
      else process.env.JASONOS_UNLOCK_SECRET = previous;
    }
  });

  it("rejects a forged stamp", async () => {
    const previous = process.env.JASONOS_UNLOCK_SECRET;
    process.env.JASONOS_UNLOCK_SECRET = "test-unlock-secret";
    try {
      const now = 1_700_000_000_000;
      assert.equal(await isUnlockStampFresh(`${now}.deadbeef`, now), false);
      assert.equal(await isUnlockStampFresh(String(now), now), false);
      assert.equal(await isUnlockStampFresh(undefined), false);
    } finally {
      if (previous === undefined) delete process.env.JASONOS_UNLOCK_SECRET;
      else process.env.JASONOS_UNLOCK_SECRET = previous;
    }
  });

  it("only follows in-app next paths", () => {
    assert.equal(safeNextPath("/today"), "/today");
    assert.equal(safeNextPath("https://evil.example"), "/");
    assert.equal(safeNextPath("//evil.example"), "/");
    assert.equal(safeNextPath(null), "/");
  });

  it("keeps Auth callback URLs query-free", () => {
    assert.equal(authCallbackUrl("https://jasonos.vercel.app"), "https://jasonos.vercel.app/auth/callback");
    assert.equal(authCallbackUrl("https://jasonos.vercel.app/"), "https://jasonos.vercel.app/auth/callback");
  });
});


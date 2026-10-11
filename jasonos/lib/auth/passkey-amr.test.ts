import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PASSKEY_AMR_MAX_AGE_SECONDS,
  hasRecentPasskeyAmr,
  normalizeAmrEntries,
} from "./passkey-amr.ts";

describe("passkey AMR checks", () => {
  it("normalizes object and string amr formats", () => {
    assert.deepEqual(
      normalizeAmrEntries([
        { method: "oauth", timestamp: 100 },
        "passkey",
        { method: " PASSKEY ", timestamp: 200 },
        null,
      ]),
      [
        { method: "oauth", timestamp: 100 },
        { method: "passkey" },
        { method: "passkey", timestamp: 200 },
      ]
    );
  });

  it("accepts a recent passkey amr entry", () => {
    const now = 1_700_000_000;
    assert.equal(
      hasRecentPasskeyAmr([{ method: "passkey", timestamp: now - 30 }], now),
      true
    );
    assert.equal(
      hasRecentPasskeyAmr([{ method: "mfa/webauthn", timestamp: now - 60 }], now),
      true
    );
  });

  it("rejects oauth-only or stale passkey amr", () => {
    const now = 1_700_000_000;
    assert.equal(
      hasRecentPasskeyAmr([{ method: "oauth", timestamp: now }], now),
      false
    );
    assert.equal(
      hasRecentPasskeyAmr(
        [{ method: "passkey", timestamp: now - PASSKEY_AMR_MAX_AGE_SECONDS - 1 }],
        now
      ),
      false
    );
  });

  it("uses token iat when amr entry has no timestamp", () => {
    const now = 1_700_000_000;
    assert.equal(
      hasRecentPasskeyAmr(["passkey"], now, { tokenIssuedAt: now - 10 }),
      true
    );
    assert.equal(
      hasRecentPasskeyAmr(["passkey"], now, {
        tokenIssuedAt: now - PASSKEY_AMR_MAX_AGE_SECONDS - 1,
      }),
      false
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  describeBeeperTokenProblem,
  interpretBeeperAuthStatuses,
} from "./beeper-health.ts";

describe("interpretBeeperAuthStatuses", () => {
  it("treats info 200 + accounts 401 as expired, not healthy", () => {
    assert.deepEqual(interpretBeeperAuthStatuses(200, 401), { kind: "expired" });
  });

  it("treats info 200 + accounts 403 as expired", () => {
    assert.deepEqual(interpretBeeperAuthStatuses(200, 403), { kind: "expired" });
  });

  it("treats both 200 as healthy", () => {
    assert.deepEqual(interpretBeeperAuthStatuses(200, 200), { kind: "healthy" });
  });

  it("treats info 401 as expired even if accounts never ran", () => {
    assert.deepEqual(interpretBeeperAuthStatuses(401, null), { kind: "expired" });
  });

  it("treats a down Desktop as unreachable, not expired", () => {
    assert.deepEqual(interpretBeeperAuthStatuses(null, null), {
      kind: "unreachable",
    });
  });

  it("treats info 200 + accounts timeout as unreachable", () => {
    assert.deepEqual(interpretBeeperAuthStatuses(200, null), {
      kind: "unreachable",
    });
  });

  it("surfaces a non-auth error status from info", () => {
    assert.deepEqual(interpretBeeperAuthStatuses(502, 200), {
      kind: "bad_response",
      status: 502,
    });
  });
});

describe("describeBeeperTokenProblem", () => {
  it("rejects a pasted Sync 401 toast", () => {
    const pasted =
      "failed: Beeper API 401: Beeper token expired. In Beeper Desktop → Settings → Integrations → Approved connections, create a new token, then paste it in JasonOS Settings → Beeper (or update BEEPER_ACCESS_TOKEN) and hit Test Connection";
    const problem = describeBeeperTokenProblem(pasted);
    assert.ok(problem);
    assert.match(problem, /error message|not a Beeper token/i);
  });

  it("accepts a normal opaque token", () => {
    assert.equal(
      describeBeeperTokenProblem("bp_live_abc123XYZ-_~"),
      null
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveContactFirm } from "./contact-firm.ts";

describe("resolveContactFirm", () => {
  it("uses the linked company name first", () => {
    assert.equal(
      resolveContactFirm("Horizon Media", ["firm:horizon-media"]),
      "Horizon Media"
    );
  });

  it("falls back to a firm: tag, turning hyphens into spaces", () => {
    assert.equal(resolveContactFirm(null, ["vip", "firm:horizon-media"]), "horizon media");
  });

  it("returns null when there is no company and no firm tag", () => {
    assert.equal(resolveContactFirm(null, ["alumni:tbwa"]), null);
    assert.equal(resolveContactFirm("  ", []), null);
  });
});

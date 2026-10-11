import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clientIp, mcpLoginAllowed } from "./rate-limit.ts";

describe("MCP login rate limit", () => {
  it("allows a handful of attempts then blocks", () => {
    const ip = `test-${Date.now()}`;
    for (let i = 0; i < 8; i += 1) {
      assert.equal(mcpLoginAllowed(ip), true);
    }
    assert.equal(mcpLoginAllowed(ip), false);
  });

  it("reads the first forwarded IP", () => {
    const request = new Request("https://jasonos.vercel.app/api/mcp/oauth/authorize", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    });
    assert.equal(clientIp(request), "203.0.113.9");
  });
});

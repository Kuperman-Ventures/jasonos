import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { McpServer } from "@modelcontextprotocol/server";
import { tokensEqual, verifyMcpBearer } from "./auth.ts";
import { registerJasonosTools } from "./register.ts";
import { errorResult, jsonResult, sanitizeSearch } from "./result.ts";

describe("MCP token compare", () => {
  it("accepts matching tokens", () => {
    assert.equal(tokensEqual("abc123", "abc123"), true);
  });

  it("rejects different tokens of the same length", () => {
    assert.equal(tokensEqual("abc123", "abc124"), false);
  });

  it("rejects different lengths without throwing", () => {
    assert.equal(tokensEqual("short", "much-longer-token"), false);
  });
});

describe("verifyMcpBearer", () => {
  it("returns undefined when the env token is missing", () => {
    const previous = process.env.JASONOS_MCP_TOKEN;
    delete process.env.JASONOS_MCP_TOKEN;
    try {
      const req = new Request("https://jasonos.vercel.app/api/mcp");
      assert.equal(verifyMcpBearer(req, "anything"), undefined);
    } finally {
      if (previous === undefined) delete process.env.JASONOS_MCP_TOKEN;
      else process.env.JASONOS_MCP_TOKEN = previous;
    }
  });

  it("returns auth info for the matching bearer token", () => {
    const previous = process.env.JASONOS_MCP_TOKEN;
    process.env.JASONOS_MCP_TOKEN = "test-token-value";
    try {
      const req = new Request("https://jasonos.vercel.app/api/mcp");
      const info = verifyMcpBearer(req, "test-token-value");
      assert.ok(info);
      assert.equal(info.clientId, "jasonos-mcp");
      assert.equal(info.token, "test-token-value");
      assert.ok(info.expiresAt && info.expiresAt > Date.now() / 1000);
    } finally {
      if (previous === undefined) delete process.env.JASONOS_MCP_TOKEN;
      else process.env.JASONOS_MCP_TOKEN = previous;
    }
  });
});

describe("MCP result helpers", () => {
  it("serializes JSON payloads", () => {
    const result = jsonResult({ ok: true, n: 1 });
    assert.equal(result.content[0]?.type, "text");
    assert.match(result.content[0]?.text ?? "", /"ok": true/);
  });

  it("marks thrown errors", () => {
    const result = errorResult(new Error("nope"));
    assert.equal(result.isError, true);
    assert.match(result.content[0]?.text ?? "", /nope/);
  });

  it("strips PostgREST metacharacters from search", () => {
    assert.equal(sanitizeSearch("Ada, Lovelace%"), "Ada Lovelace");
    assert.equal(sanitizeSearch("  (foo)_bar  "), "foo bar");
  });
});

describe("registerJasonosTools", () => {
  it("registers tools on a server without throwing", () => {
    const server = new McpServer({ name: "jasonos-test", version: "0.0.0" });
    registerJasonosTools(server);
  });
});

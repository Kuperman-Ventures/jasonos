import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { McpServer } from "@modelcontextprotocol/server";
import {
  authorizeMcpRequest,
  extractBearer,
  pickMcpToken,
  tokensEqual,
} from "./auth.ts";
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

describe("pickMcpToken", () => {
  it("prefers Settings over env", () => {
    assert.equal(pickMcpToken(" settings-token ", "env-token"), "settings-token");
  });

  it("falls back to env", () => {
    assert.equal(pickMcpToken("  ", "env-token"), "env-token");
  });
});

describe("extractBearer", () => {
  it("reads a Bearer header", () => {
    assert.equal(extractBearer("Bearer abc"), "abc");
  });

  it("returns undefined without a token", () => {
    assert.equal(extractBearer("Basic abc"), undefined);
    assert.equal(extractBearer(null), undefined);
  });
});

describe("authorizeMcpRequest", () => {
  it("returns 503 when no token is configured", async () => {
    const previous = process.env.JASONOS_MCP_TOKEN;
    delete process.env.JASONOS_MCP_TOKEN;
    try {
      const res = await authorizeMcpRequest(new Request("https://jasonos.vercel.app/api/mcp"));
      assert.ok(res);
      assert.equal(res.status, 503);
      assert.equal(res.headers.get("www-authenticate"), null);
    } finally {
      if (previous === undefined) delete process.env.JASONOS_MCP_TOKEN;
      else process.env.JASONOS_MCP_TOKEN = previous;
    }
  });

  it("returns 401 without advertising OAuth", async () => {
    const previous = process.env.JASONOS_MCP_TOKEN;
    process.env.JASONOS_MCP_TOKEN = "test-token-value";
    try {
      const res = await authorizeMcpRequest(
        new Request("https://jasonos.vercel.app/api/mcp", {
          headers: { Authorization: "Bearer wrong" },
        })
      );
      assert.ok(res);
      assert.equal(res.status, 401);
      assert.equal(res.headers.get("www-authenticate"), null);
    } finally {
      if (previous === undefined) delete process.env.JASONOS_MCP_TOKEN;
      else process.env.JASONOS_MCP_TOKEN = previous;
    }
  });

  it("allows a matching bearer token", async () => {
    const previous = process.env.JASONOS_MCP_TOKEN;
    process.env.JASONOS_MCP_TOKEN = "test-token-value";
    try {
      const res = await authorizeMcpRequest(
        new Request("https://jasonos.vercel.app/api/mcp", {
          headers: { Authorization: "Bearer test-token-value" },
        })
      );
      assert.equal(res, null);
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

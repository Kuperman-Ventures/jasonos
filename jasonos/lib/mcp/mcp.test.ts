import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { McpServer } from "@modelcontextprotocol/server";
import {
  authorizeMcpRequest,
  extractBearer,
  pickMcpToken,
  tokensEqual,
} from "./auth.ts";
import {
  JASONOS_PRM_URL,
  authorizationServerMetadata,
  buildAuthorizeRedirect,
  exchangeOAuthToken,
  issueAccessToken,
  parseAuthorizeParams,
  pkceS256,
  protectedResourceMetadata,
  wwwAuthenticate,
} from "./oauth.ts";
import { registerJasonosTools } from "./register.ts";
import { listJasonosAreas } from "./reads.ts";
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

  it("returns 401 that points Cowork at path-specific login metadata", async () => {
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
      // Node redacts a lone Bearer resource_metadata param. Pairing it with
      // error="invalid_token" keeps the real name on the wire.
      const advertise = res.headers.get("www-authenticate") ?? "";
      assert.match(advertise, /resource_metadata="https:\/\/jasonos\.vercel\.app\/\.well-known\/oauth-protected-resource\/api\/mcp"/);
      const body = (await res.json()) as { resource_metadata?: string };
      assert.equal(body.resource_metadata, JASONOS_PRM_URL);
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

  it("allows a Cowork login token signed with the Settings password", async () => {
    const previous = process.env.JASONOS_MCP_TOKEN;
    process.env.JASONOS_MCP_TOKEN = "test-token-value";
    try {
      const { access_token } = issueAccessToken("test-token-value");
      const res = await authorizeMcpRequest(
        new Request("https://jasonos.vercel.app/api/mcp", {
          headers: { Authorization: `Bearer ${access_token}` },
        })
      );
      assert.equal(res, null);
    } finally {
      if (previous === undefined) delete process.env.JASONOS_MCP_TOKEN;
      else process.env.JASONOS_MCP_TOKEN = previous;
    }
  });
});

describe("OAuth login helpers", () => {
  it("keeps Cursor's root probe URL out of the Cowork metadata", () => {
    assert.equal(
      wwwAuthenticate(),
      `Bearer error="invalid_token", resource_metadata="${JASONOS_PRM_URL}"`
    );
    assert.equal(JASONOS_PRM_URL, "https://jasonos.vercel.app/.well-known/oauth-protected-resource/api/mcp");
    assert.equal(protectedResourceMetadata().resource, "https://jasonos.vercel.app/api/mcp");
    assert.deepEqual(protectedResourceMetadata().authorization_servers, [
      "https://jasonos.vercel.app/api/mcp/oauth",
    ]);
    assert.equal(
      authorizationServerMetadata().authorization_endpoint,
      "https://jasonos.vercel.app/api/mcp/oauth/authorize"
    );
  });

  it("rejects a bad return address instead of redirecting there", () => {
    const parsed = parseAuthorizeParams(
      new URLSearchParams({
        client_id: "claude",
        redirect_uri: "http://evil.example/callback",
        code_challenge: "a".repeat(43),
        code_challenge_method: "S256",
        response_type: "code",
      })
    );
    assert.equal(parsed.ok, false);
  });

  it("issues a code and exchanges it with PKCE", () => {
    const secret = "settings-password";
    const verifier = `v${"a".repeat(42)}`;
    const parsed = parseAuthorizeParams(
      new URLSearchParams({
        client_id: "claude",
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        code_challenge: pkceS256(verifier),
        code_challenge_method: "S256",
        response_type: "code",
        state: "abc",
        resource: "https://jasonos.vercel.app/api/mcp",
      })
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const issued = buildAuthorizeRedirect(secret, parsed.value);
    assert.equal(issued.ok, true);
    if (!issued.ok) return;
    const code = new URL(issued.redirect).searchParams.get("code") ?? "";
    const ok = exchangeOAuthToken(secret, (key) => {
      if (key === "grant_type") return "authorization_code";
      if (key === "code") return code;
      if (key === "code_verifier") return verifier;
      if (key === "redirect_uri") return parsed.value.redirectUri;
      return "";
    });
    assert.equal(ok.status, 200);
    assert.equal(typeof ok.body.access_token, "string");

    const bad = exchangeOAuthToken(secret, (key) => {
      if (key === "grant_type") return "authorization_code";
      if (key === "code") return code;
      if (key === "code_verifier") return "wrong-verifier-wrong-verifier-wrong";
      if (key === "redirect_uri") return parsed.value.redirectUri;
      return "";
    });
    assert.equal(bad.status, 400);
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

describe("JasonOS area map", () => {
  it("points Claude at tools for the main dashboard areas", () => {
    const map = listJasonosAreas();
    const tools = map.areas.flatMap((area) => area.tools);
    assert.ok(tools.includes("get_today"));
    assert.ok(tools.includes("get_outreach_queue"));
    assert.ok(tools.includes("get_inbox_dispatch"));
    assert.ok(tools.includes("get_job_alerts"));
    assert.ok(tools.includes("get_morning_brief"));
  });
});

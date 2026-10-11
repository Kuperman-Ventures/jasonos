import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hidesJasonosChrome, isCronPath, isPublicJasonosPath } from "./public-routes.ts";

describe("public JasonOS paths", () => {
  it("leaves IUGR and Ski Tracker open", () => {
    assert.equal(isPublicJasonosPath("/iugr"), true);
    assert.equal(isPublicJasonosPath("/iugr/deck"), true);
    assert.equal(isPublicJasonosPath("/projects/ski-tracker"), true);
    assert.equal(isPublicJasonosPath("/api/ski-tracker"), true);
  });

  it("leaves login, Auth callback, MCP, and well-known open", () => {
    assert.equal(isPublicJasonosPath("/login"), true);
    assert.equal(isPublicJasonosPath("/auth/callback"), true);
    assert.equal(isPublicJasonosPath("/api/mcp"), true);
    assert.equal(isPublicJasonosPath("/api/mcp/oauth/authorize"), true);
    assert.equal(isPublicJasonosPath("/.well-known/oauth-protected-resource/api/mcp"), true);
    assert.equal(isPublicJasonosPath("/api/morning-brief/publish"), true);
  });

  it("locks the rest of JasonOS", () => {
    assert.equal(isPublicJasonosPath("/"), false);
    assert.equal(isPublicJasonosPath("/today"), false);
    assert.equal(isPublicJasonosPath("/settings"), false);
    assert.equal(isPublicJasonosPath("/projects"), false);
    assert.equal(isPublicJasonosPath("/projects/fuck-you-batman"), false);
    assert.equal(isPublicJasonosPath("/projects/trailbound-at"), false);
    assert.equal(isPublicJasonosPath("/api/dashboard/action-queue"), false);
  });

  it("hides chrome on login, IUGR, and Ski Tracker", () => {
    assert.equal(hidesJasonosChrome("/login"), true);
    assert.equal(hidesJasonosChrome("/iugr"), true);
    assert.equal(hidesJasonosChrome("/projects/ski-tracker"), true);
    assert.equal(hidesJasonosChrome("/today"), false);
  });

  it("knows cron paths", () => {
    assert.equal(isCronPath("/api/inbox-dispatch"), true);
    assert.equal(isCronPath("/api/monitoring/health-check"), true);
    assert.equal(isCronPath("/api/dashboard/action-queue"), false);
  });
});

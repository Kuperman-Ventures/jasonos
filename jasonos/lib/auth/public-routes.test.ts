import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hidesJasonosChrome,
  isLiveCallPath,
  isCronPath,
  isPublicJasonosPath,
  matchesPathPrefix,
} from "./public-routes.ts";

describe("public JasonOS paths", () => {
  it("leaves IUGR and Ski Tracker open", () => {
    assert.equal(isPublicJasonosPath("/iugr"), true);
    assert.equal(isPublicJasonosPath("/iugr/deck"), true);
    assert.equal(isPublicJasonosPath("/projects/ski-tracker"), true);
    assert.equal(isPublicJasonosPath("/api/ski-tracker"), true);
    assert.equal(isPublicJasonosPath("/rank"), true);
    assert.equal(isPublicJasonosPath("/api/rank"), true);
    assert.equal(isPublicJasonosPath("/christmas"), true);
  });

  it("leaves login, Auth callback, MCP, publish routes, and well-known open", () => {
    assert.equal(isPublicJasonosPath("/login"), true);
    assert.equal(isPublicJasonosPath("/auth/callback"), true);
    assert.equal(isPublicJasonosPath("/api/mcp"), true);
    assert.equal(isPublicJasonosPath("/api/mcp/oauth/authorize"), true);
    assert.equal(isPublicJasonosPath("/.well-known/oauth-protected-resource/api/mcp"), true);
    assert.equal(isPublicJasonosPath("/api/morning-brief/publish"), true);
    assert.equal(isPublicJasonosPath("/api/commitment-check/publish"), true);
    assert.equal(isPublicJasonosPath("/api/auth/wispr/callback"), true);
    assert.equal(isPublicJasonosPath("/api/fyb"), true);
  });

  it("locks the rest of JasonOS and does not prefix-bleed", () => {
    assert.equal(isPublicJasonosPath("/"), false);
    assert.equal(isPublicJasonosPath("/today"), false);
    assert.equal(isPublicJasonosPath("/settings"), false);
    assert.equal(isPublicJasonosPath("/projects"), false);
    assert.equal(isPublicJasonosPath("/projects/fuck-you-batman"), false);
    assert.equal(isPublicJasonosPath("/projects/trailbound-at"), false);
    assert.equal(isPublicJasonosPath("/projects/ski-tracker-evil"), false);
    assert.equal(isPublicJasonosPath("/api/ski-tracker-evil"), false);
    assert.equal(isPublicJasonosPath("/ranking"), false);
    assert.equal(isPublicJasonosPath("/api/ranking"), false);
    assert.equal(isPublicJasonosPath("/christmaseve"), false);
    assert.equal(isPublicJasonosPath("/api/mcpish"), false);
    assert.equal(isPublicJasonosPath("/api/dashboard/action-queue"), false);
  });

  it("matches prefixes only on a path boundary", () => {
    assert.equal(matchesPathPrefix("/api/mcp", "/api/mcp"), true);
    assert.equal(matchesPathPrefix("/api/mcp/oauth", "/api/mcp"), true);
    assert.equal(matchesPathPrefix("/api/mcpish", "/api/mcp"), false);
  });

  it("recognizes the live call screen", () => {
    assert.equal(isLiveCallPath("/live/decks/abc/rehearse"), true);
    assert.equal(isLiveCallPath("/live/decks/abc/run"), true);
    assert.equal(isLiveCallPath("/live/decks/abc/run/"), true);
    assert.equal(isLiveCallPath("/live/decks/abc"), false);
    assert.equal(isLiveCallPath("/live/decks/abc/run/extra"), false);
    assert.equal(isLiveCallPath("/live/slides/abc/run"), true);
    assert.equal(isLiveCallPath("/meetings/abc/live"), false);
    assert.equal(isLiveCallPath("/live/playbooks/abc/rehearse"), true);
    assert.equal(isLiveCallPath("/live/playbooks/abc"), false);
  });

  it("hides chrome on login, IUGR, and Ski Tracker", () => {
    assert.equal(hidesJasonosChrome("/login"), true);
    assert.equal(hidesJasonosChrome("/iugr"), true);
    assert.equal(hidesJasonosChrome("/projects/ski-tracker"), true);
    assert.equal(hidesJasonosChrome("/rank"), true);
    assert.equal(hidesJasonosChrome("/christmas"), true);
    assert.equal(hidesJasonosChrome("/today"), false);
  });

  it("knows cron paths", () => {
    assert.equal(isCronPath("/api/inbox-dispatch"), false);
    assert.equal(isCronPath("/api/sync/daily"), true);
    assert.equal(isCronPath("/api/monitoring/health-check"), true);
    assert.equal(isCronPath("/api/browning-networking/run"), true);
    assert.equal(isCronPath("/api/browning-networking/holds"), true);
    assert.equal(isCronPath("/api/browning-networking/reminders"), true);
    assert.equal(isCronPath("/api/family-meeting/freeze-print"), true);
    assert.equal(isCronPath("/api/dashboard/action-queue"), false);
  });
});


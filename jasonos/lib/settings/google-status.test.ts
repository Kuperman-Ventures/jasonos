import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  googleMailboxHealth,
  overlayGoogleOauthOntoServices,
  summarizeGoogleMailboxes,
} from "./google-status.ts";

describe("googleMailboxHealth", () => {
  it("treats a stored grant with no usable token as expired", () => {
    assert.equal(
      googleMailboxHealth({ connected: true, needsReconnect: true }),
      "expired"
    );
  });

  it("treats missing required scopes as limited, not connected", () => {
    assert.equal(
      googleMailboxHealth({
        connected: true,
        needsReconnect: true,
        missingScopes: ["https://www.googleapis.com/auth/gmail.send"],
      }),
      "limited"
    );
  });

  it("treats a usable token as connected", () => {
    assert.equal(
      googleMailboxHealth({ connected: true, needsReconnect: false }),
      "connected"
    );
  });

  it("treats a missing grant as not connected", () => {
    assert.equal(
      googleMailboxHealth({ connected: false, needsReconnect: false }),
      "not_connected"
    );
  });
});

describe("summarizeGoogleMailboxes", () => {
  it("flags personal Gmail expiry as a Settings reconnect problem without hiding Advisors", () => {
    const summary = summarizeGoogleMailboxes([
      {
        label: "Advisors Google",
        connected: true,
        needsReconnect: false,
        error: null,
      },
      {
        label: "Personal Gmail",
        connected: true,
        needsReconnect: true,
        error: "jskuperman@gmail.com: sign-in expired. Reconnect personal Gmail in Settings.",
      },
    ]);

    assert.equal(summary.status, "expired");
    assert.equal(summary.health_status, "degraded");
    assert.equal(summary.success, false);
    assert.match(summary.error_message ?? "", /jskuperman@gmail.com: sign-in expired/);
    assert.match(summary.health_details, /Advisors Google: connected/);
  });

  it("flags Advisors missing Gmail send as degraded, not healthy", () => {
    const summary = summarizeGoogleMailboxes([
      {
        label: "Advisors Google",
        connected: true,
        needsReconnect: true,
        missingScopes: ["https://www.googleapis.com/auth/gmail.send"],
        error:
          "jason@kupermanadvisors.com: missing Gmail send. Reconnect Advisors Google in Settings and allow all requested permissions.",
      },
      {
        label: "Personal Gmail",
        connected: true,
        needsReconnect: false,
        error: null,
      },
    ]);
    assert.equal(summary.status, "expired");
    assert.equal(summary.health_status, "degraded");
    assert.equal(summary.success, false);
    assert.match(summary.error_message ?? "", /missing Gmail send/);
  });

  it("marks both mailboxes missing as not configured", () => {
    const summary = summarizeGoogleMailboxes([
      { label: "Advisors Google", connected: false, needsReconnect: false, error: null },
      { label: "Personal Gmail", connected: false, needsReconnect: false, error: null },
    ]);
    assert.equal(summary.status, "not_configured");
    assert.equal(summary.health_status, "down");
    assert.equal(summary.success, false);
  });
});

describe("overlayGoogleOauthOntoServices", () => {
  it("replaces Gmail and Calendar MCP-style connected with live OAuth expiry", () => {
    const services = overlayGoogleOauthOntoServices(
      [
        {
          service_name: "gmail",
          status: "connected" as const,
          health_status: "healthy" as const,
          health_details: "Managed via Cursor MCP.",
          error_message: null,
        },
        {
          service_name: "google_calendar",
          status: "connected" as const,
          health_status: "healthy" as const,
          health_details: "Managed via Cursor MCP.",
          error_message: null,
        },
        {
          service_name: "stripe",
          status: "connected" as const,
          health_status: "healthy" as const,
          health_details: null,
          error_message: null,
        },
      ],
      {
        advisorsConnected: true,
        gmailConnected: true,
        advisorsNeedsReconnect: false,
        gmailNeedsReconnect: true,
        advisorsError: null,
        gmailError: "jskuperman@gmail.com: sign-in expired. Reconnect personal Gmail in Settings.",
      }
    );

    assert.equal(services[0].status, "expired");
    assert.equal(services[0].health_status, "degraded");
    assert.match(services[0].error_message ?? "", /Reconnect personal Gmail/);
    assert.equal(services[1].status, "expired");
    assert.equal(services[2].status, "connected");
    assert.equal(services[2].health_status, "healthy");
  });

  it("surfaces Advisors missing send on Gmail and Calendar service rows", () => {
    const services = overlayGoogleOauthOntoServices(
      [
        {
          service_name: "gmail",
          status: "connected" as const,
          health_status: "healthy" as const,
          health_details: null,
          error_message: null,
        },
        {
          service_name: "google_calendar",
          status: "connected" as const,
          health_status: "healthy" as const,
          health_details: null,
          error_message: null,
        },
      ],
      {
        advisorsConnected: true,
        gmailConnected: true,
        advisorsNeedsReconnect: true,
        gmailNeedsReconnect: false,
        advisorsError: "jason@kupermanadvisors.com: missing Gmail send.",
        gmailError: null,
        advisorsMissingScopes: ["https://www.googleapis.com/auth/gmail.send"],
        gmailMissingScopes: [],
      }
    );
    assert.equal(services[0].health_status, "degraded");
    assert.match(services[0].error_message ?? "", /missing Gmail send/);
    assert.equal(services[1].health_status, "degraded");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GOOGLE_GMAIL_SEND,
  googleMissingScopesMessage,
  missingGoogleScopes,
  normalizeOauthScopes,
} from "./google-scopes.ts";

describe("google scopes", () => {
  it("flags Advisors grants that have read but not send", () => {
    const granted = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
      "openid",
    ];
    const missing = missingGoogleScopes(granted);
    assert.deepEqual(missing, [GOOGLE_GMAIL_SEND]);
    assert.match(
      googleMissingScopesMessage({
        accountEmail: "jason@kupermanadvisors.com",
        accountLabel: "Advisors Google",
        missing,
      }) ?? "",
      /missing Gmail send/
    );
  });

  it("accepts a full grant as complete", () => {
    assert.deepEqual(
      missingGoogleScopes([
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events",
      ]),
      []
    );
  });

  it("normalizes space-delimited scope strings", () => {
    assert.ok(
      normalizeOauthScopes(
        "https://www.googleapis.com/auth/gmail.send openid email"
      ).includes(GOOGLE_GMAIL_SEND)
    );
  });
});

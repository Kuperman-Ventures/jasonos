import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OUTLOOK_MAIL_READ,
  missingOutlookScopes,
  outlookMissingScopesMessage,
} from "./outlook-scopes.ts";

describe("outlook scopes", () => {
  it("flags Outlook grants missing Mail.Read", () => {
    const missing = missingOutlookScopes([
      "https://graph.microsoft.com/Calendars.Read",
      "https://graph.microsoft.com/User.Read",
      "openid",
    ]);
    assert.ok(missing.includes(OUTLOOK_MAIL_READ));
    assert.match(
      outlookMissingScopesMessage({
        accountEmail: "jason.kuperman@outlook.com",
        missing,
      }) ?? "",
      /missing Mail read/
    );
  });

  it("accepts a full Outlook grant", () => {
    assert.deepEqual(
      missingOutlookScopes([
        "https://graph.microsoft.com/Mail.Read",
        "https://graph.microsoft.com/Calendars.Read",
        "https://graph.microsoft.com/User.Read",
      ]),
      []
    );
  });
});

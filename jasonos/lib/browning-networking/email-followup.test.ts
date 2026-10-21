import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emailFollowUpStatusLabel,
  followupMatchesContactEmail,
  pickFollowUpForContact,
} from "./email-followup.ts";

describe("browning email follow-up match", () => {
  it("matches by recipient email", () => {
    assert.equal(
      followupMatchesContactEmail(
        {
          status: "scheduled",
          follow_up_due: "2026-10-23",
          follow_up_days: 3,
          to_line: "jeff@jeffkellick.com",
          recipients: [{ email: "jeff@jeffkellick.com", name: null }],
        },
        "jeff@jeffkellick.com"
      ),
      true
    );
  });

  it("prefers scheduled over new", () => {
    const pick = pickFollowUpForContact(
      [
        {
          status: "new",
          follow_up_due: null,
          follow_up_days: null,
          to_line: "jeff@jeffkellick.com",
          recipients: [{ email: "jeff@jeffkellick.com" }],
        },
        {
          status: "scheduled",
          follow_up_due: "2026-10-23",
          follow_up_days: 3,
          to_line: "jeff@jeffkellick.com",
          recipients: [{ email: "jeff@jeffkellick.com" }],
        },
      ],
      "jeff@jeffkellick.com"
    );
    assert.deepEqual(pick, {
      status: "scheduled",
      followUpDue: "2026-10-23",
      followUpDays: 3,
    });
  });

  it("labels scheduled future and due rows", () => {
    assert.equal(
      emailFollowUpStatusLabel(
        { status: "scheduled", followUpDue: "2026-10-23", followUpDays: 3 },
        "2026-10-21"
      ),
      "Follow-up scheduled · Oct 23"
    );
    assert.equal(
      emailFollowUpStatusLabel(
        { status: "scheduled", followUpDue: "2026-10-21", followUpDays: 1 },
        "2026-10-21"
      ),
      "Follow-up due · Oct 21"
    );
    assert.equal(
      emailFollowUpStatusLabel(
        { status: "new", followUpDue: null, followUpDays: null },
        "2026-10-21"
      ),
      "Email follow-up — pick a day"
    );
  });
});

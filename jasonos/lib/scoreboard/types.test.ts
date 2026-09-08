import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applicationKey,
  canonicalApplicationRows,
  defaultStatusFromResult,
  isApplicationWorkSearch,
  resolvedScoreboardStatus,
  resultFromScoreboardStatus,
} from "./types.ts";

describe("status ↔ result mapping", () => {
  it("maps each pipeline status to the matching NYUI result", () => {
    assert.equal(resultFromScoreboardStatus("rejected"), "Rejected");
    assert.equal(resultFromScoreboardStatus("next_steps"), "Interview Scheduled");
    assert.equal(resultFromScoreboardStatus("offer"), "Offer Received");
    assert.equal(resultFromScoreboardStatus("submitted"), "Application Submitted");
    assert.equal(resultFromScoreboardStatus("no_reply"), "Pending");
  });

  it("round-trips result back to status", () => {
    for (const status of [
      "submitted",
      "no_reply",
      "next_steps",
      "rejected",
      "offer",
    ] as const) {
      assert.equal(
        defaultStatusFromResult(resultFromScoreboardStatus(status)),
        status
      );
    }
  });

  it("treats a null scoreboard_status as the result mapping (Prolific case)", () => {
    assert.equal(
      resolvedScoreboardStatus({
        scoreboard_status: null,
        result: "Rejected",
      }),
      "rejected"
    );
    assert.equal(
      resolvedScoreboardStatus({
        scoreboard_status: "rejected",
        result: "Application Submitted",
      }),
      "rejected"
    );
  });
});

describe("canonical application rows", () => {
  it("hides NYUI follow-ups so one job is one Scoreboard row", () => {
    const rows = canonicalApplicationRows([
      {
        id: "root",
        date: "2026-05-11",
        company_name: "Starz",
        position_applied: "SVP, Creative",
        parent_activity_id: null,
        scoreboard_status: "no_reply",
        result: "Application Submitted",
      },
      {
        id: "child",
        date: "2026-05-12",
        company_name: "Starz",
        position_applied: "SVP, Creative",
        parent_activity_id: "root",
        scoreboard_status: "no_reply",
        result: "Application Submitted",
      },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, "root");
  });

  it("collapses unlinked duplicates by company+role and keeps the later outcome", () => {
    const rows = canonicalApplicationRows([
      {
        id: "a",
        date: "2026-07-16",
        company_name: "Nano Nuclear",
        position_applied: "Chief Marketing Officer",
        parent_activity_id: null,
        scoreboard_status: "next_steps",
        result: "Interview Scheduled",
      },
      {
        id: "b",
        date: "2026-07-20",
        company_name: "nano nuclear",
        position_applied: "chief marketing officer",
        parent_activity_id: null,
        scoreboard_status: "rejected",
        result: "Rejected",
      },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, "a");
    assert.equal(rows[0]?.scoreboard_status, "rejected");
    assert.equal(rows[0]?.result, "Rejected");
    assert.equal(rows[0]?.date, "2026-07-16");
  });

  it("does not treat networking rows as applications", () => {
    assert.equal(
      isApplicationWorkSearch({
        activity_tier: "networking",
        contact_method: "LinkedIn",
        result: "Pending",
      }),
      false
    );
    assert.equal(
      isApplicationWorkSearch({
        activity_tier: "employer_contact",
        contact_method: "Online Portal",
        result: "Application Submitted",
      }),
      true
    );
  });

  it("normalizes company and role for matching", () => {
    assert.equal(
      applicationKey("  Starz ", "SVP, Creative"),
      applicationKey("starz", "svp, creative")
    );
  });
});

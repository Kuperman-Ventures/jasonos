import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatSyncSummary,
  isOkPayload,
  payloadIssueText,
} from "./sync-log-format.ts";

describe("payloadIssueText", () => {
  it("joins error, errors[], and warnings[] without duplicates", () => {
    assert.equal(
      payloadIssueText({
        error: "pre-check: Bad Request",
        errors: ["pre-check: Bad Request"],
        warnings: ["Could not list Outlook folders"],
      }),
      "pre-check: Bad Request · Could not list Outlook folders"
    );
  });
});

describe("isOkPayload", () => {
  it("keeps soft warnings as ok when errors[] is empty", () => {
    assert.equal(
      isOkPayload({
        ok: true,
        inserted: 0,
        warnings: ["Could not list Outlook folders"],
      }),
      true
    );
  });

  it("flags hard errors[] even when ok was left true", () => {
    assert.equal(
      isOkPayload({
        ok: true,
        inserted: 0,
        matched: 3,
        errors: ["pre-check: Bad Request"],
        warnings: ["Could not list Outlook folders"],
      }),
      false
    );
  });
});

describe("formatSyncSummary", () => {
  it("surfaces Outlook issues that used to disappear from the Sync Log", () => {
    assert.equal(
      formatSyncSummary("outlook", {
        ok: true,
        inserted: 0,
        matched: 2,
        errors: ["pre-check: Bad Request"],
        warnings: [
          "Could not list Outlook folders (Outlook Graph 400). Scanned Sent, Inbox, and Archive only.",
        ],
      }),
      "failed: pre-check: Bad Request · Could not list Outlook folders (Outlook Graph 400). Scanned Sent, Inbox, and Archive only."
    );
  });

  it("still appends soft warnings on a successful run", () => {
    assert.equal(
      formatSyncSummary("outlook", {
        ok: true,
        inserted: 2,
        warnings: ["Archive subfolders: timeout"],
      }),
      "+2 new · Archive subfolders: timeout"
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GMAIL_EXCLUDE_DRAFTS_QUERY,
  gmailTouchExternalIdMatches,
  isGmailDraftMessage,
  isGmailSentMessage,
  shouldCountGmailMessageForTouch,
} from "./gmail-labels.ts";

describe("isGmailDraftMessage", () => {
  it("flags DRAFT regardless of case", () => {
    assert.equal(isGmailDraftMessage({ labelIds: ["INBOX", "DRAFT"] }), true);
    assert.equal(isGmailDraftMessage({ labelIds: ["draft"] }), true);
  });

  it("is false for sent mail", () => {
    assert.equal(isGmailDraftMessage({ labelIds: ["SENT"] }), false);
    assert.equal(isGmailDraftMessage({ labelIds: [] }), false);
    assert.equal(isGmailDraftMessage({}), false);
  });
});

describe("isGmailSentMessage", () => {
  it("requires SENT", () => {
    assert.equal(isGmailSentMessage({ labelIds: ["SENT"] }), true);
    assert.equal(isGmailSentMessage({ labelIds: ["INBOX"] }), false);
  });
});

describe("shouldCountGmailMessageForTouch", () => {
  it("drops drafts", () => {
    assert.equal(
      shouldCountGmailMessageForTouch({
        labelIds: ["DRAFT"],
        fromMe: true,
      }),
      false
    );
  });

  it("keeps sent outbound", () => {
    assert.equal(
      shouldCountGmailMessageForTouch({
        labelIds: ["SENT"],
        fromMe: true,
      }),
      true
    );
  });

  it("drops outbound that is not in Sent when labels are present", () => {
    assert.equal(
      shouldCountGmailMessageForTouch({
        labelIds: ["INBOX"],
        fromMe: true,
      }),
      false
    );
  });

  it("keeps inbound even without SENT", () => {
    assert.equal(
      shouldCountGmailMessageForTouch({
        labelIds: ["INBOX"],
        fromMe: false,
      }),
      true
    );
  });

  it("does not count outbound mail when Gmail omitted labels", () => {
    assert.equal(
      shouldCountGmailMessageForTouch({ fromMe: true }),
      false
    );
  });

  it("does not count a scheduled send", () => {
    assert.equal(
      shouldCountGmailMessageForTouch({
        labelIds: ["SCHEDULED"],
        fromMe: true,
      }),
      false
    );
  });

  it("keeps inbound mail when labels are missing", () => {
    assert.equal(
      shouldCountGmailMessageForTouch({ fromMe: false }),
      true
    );
  });
});

describe("gmailTouchExternalIdMatches", () => {
  it("matches bare, prefixed, and per-contact touch ids", () => {
    assert.equal(gmailTouchExternalIdMatches("abc123", "abc123"), true);
    assert.equal(gmailTouchExternalIdMatches("gmail:abc123", "abc123"), true);
    assert.equal(
      gmailTouchExternalIdMatches("gmail:abc123::contact", "abc123"),
      true
    );
    assert.equal(gmailTouchExternalIdMatches("gmail:other", "abc123"), false);
    assert.equal(gmailTouchExternalIdMatches("abc123::contact", "abc123"), true);
  });
});

describe("GMAIL_EXCLUDE_DRAFTS_QUERY", () => {
  it("is the Gmail search fragment", () => {
    assert.equal(GMAIL_EXCLUDE_DRAFTS_QUERY, "-in:drafts");
  });
});

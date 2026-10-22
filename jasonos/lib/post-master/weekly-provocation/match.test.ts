import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bestBody,
  bodyForParsing,
  gmailProvocationQuery,
  htmlToText,
  isProvocationSender,
  isWeeklyProvocationMessage,
  looksLikeProvocationRequest,
  normalizeRfc822,
} from "./match.ts";

describe("isProvocationSender", () => {
  it("matches Will Duffy by mailbox and by name", () => {
    assert.equal(
      isProvocationSender("Will Duffy <wduffy@3cventures.com>"),
      true
    );
    assert.equal(
      isProvocationSender("William L. Duffy <will@example.com>"),
      true
    );
  });

  it("matches Rover by name or local-part, and an address stored on the contact", () => {
    assert.equal(isProvocationSender("Rover <rover@example.com>"), true);
    assert.equal(isProvocationSender("Rover Smith"), true);
    assert.equal(isProvocationSender("rover@letters.example"), true);
    assert.equal(
      isProvocationSender("R. Notes <r@example.com>", ["r@example.com"]),
      true
    );
  });

  it("skips lookalikes and Jason's own mail", () => {
    assert.equal(isProvocationSender("Grover <grover@example.com>"), false);
    assert.equal(isProvocationSender("Will <will@example.com>"), false);
    assert.equal(
      isProvocationSender("Jason Kuperman <jason@kupermanadvisors.com>"),
      false
    );
  });
});

describe("looksLikeProvocationRequest", () => {
  it("accepts a weekly provocation subject or an explicit ask", () => {
    assert.equal(
      looksLikeProvocationRequest("Weekly Provocation 12", "See below."),
      true
    );
    assert.equal(
      looksLikeProvocationRequest(
        "For Friday",
        "Please reply to this week's provocation."
      ),
      true
    );
    assert.equal(
      looksLikeProvocationRequest(
        "Question",
        "The provocation this round: what happens to retail media budgets? Weigh in."
      ),
      true
    );
  });

  it("ignores a passing use of the word", () => {
    assert.equal(
      looksLikeProvocationRequest(
        "Lunch Thursday",
        "That campaign was a provocation and the room loved it."
      ),
      false
    );
  });
});

describe("isWeeklyProvocationMessage", () => {
  it("requires both the sender and the ask", () => {
    assert.equal(
      isWeeklyProvocationMessage({
        from: "Will Duffy <wduffy@3cventures.com>",
        subject: "Weekly Provocation",
        body: "Three questions. Send a response by Friday.",
      }),
      true
    );
    assert.equal(
      isWeeklyProvocationMessage({
        from: "Libby Topel <libby@3cventures.com>",
        subject: "Weekly Provocation",
        body: "Please respond.",
      }),
      false
    );
    assert.equal(
      isWeeklyProvocationMessage({
        from: "Rover <rover@example.com>",
        subject: "Catch up",
        body: "Free Thursday?",
      }),
      false
    );
  });
});

describe("body cleanup", () => {
  it("turns a simple html note into text", () => {
    assert.equal(
      htmlToText("<p>Hello&nbsp;there</p><p>Question one?</p>"),
      "Hello there\n\nQuestion one?"
    );
  });

  it("keeps this week's ask and drops the quoted prior thread", () => {
    const raw = [
      "Weekly Provocation.",
      "",
      "What should a brand do when the platform changes the auction rules?",
      "",
      "On Mon, May 4, 2026 at 9:00 AM Will Duffy wrote:",
      "Last week's provocation was about retail media.",
    ].join("\n");
    const parsed = bodyForParsing(raw);
    assert.match(parsed, /auction rules/);
    assert.equal(parsed.includes("retail media"), false);
  });

  it("keeps a forward when the provocation is under the original message", () => {
    const raw = [
      "Sending this along.",
      "",
      "---------- Original Message ----------",
      "From: Will Duffy",
      "Subject: Weekly Provocation",
      "",
      "Please respond: is retail media still a growth budget?",
    ].join("\n");
    assert.match(bodyForParsing(raw), /retail media still a growth budget/);
  });

  it("prefers the longer html body when the plain part is a stub", () => {
    const body = bestBody(
      "View this email in your browser.",
      "<p>Weekly Provocation</p><p>What changed in retail media this month, and where do the numbers disagree?</p>"
    );
    assert.match(body, /retail media this month/);
  });
});

describe("gmail query and message ids", () => {
  it("searches Will Duffy and Rover after the sync window", () => {
    const query = gmailProvocationQuery({
      after: "2026/10/01",
      extraEmails: ["rover@letters.example", "not-an-email"],
    });
    assert.match(query, /from:wduffy@3cventures\.com/);
    assert.match(query, /from:rover@letters\.example/);
    assert.match(query, /after:2026\/10\/01/);
    assert.match(query, /-in:drafts/);
    assert.equal(query.includes("not-an-email"), false);
  });

  it("normalizes rfc822 ids", () => {
    assert.equal(
      normalizeRfc822(" <ABC@mail.example> "),
      "abc@mail.example"
    );
    assert.equal(normalizeRfc822("   "), null);
  });
});

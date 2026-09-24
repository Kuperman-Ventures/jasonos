import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  externalRecipients,
  followUpDueYmd,
  followupDaysOverdue,
  isFollowupDue,
  latestHitPerThread,
  parseAddressHeader,
  planSentFollowupUpsert,
  qualifySentMessage,
  recipientLine,
  type SentMailHit,
} from "./sent-followups";

const hit = (overrides: Partial<SentMailHit> = {}): SentMailHit => ({
  threadId: "t1",
  messageId: "m1",
  subject: "Checking in",
  sentAt: "2026-09-20T15:00:00.000Z",
  snippet: "Hi",
  toLine: "Ada Lovelace",
  recipients: [{ name: "Ada Lovelace", email: "ada@example.com" }],
  ...overrides,
});

describe("parseAddressHeader", () => {
  it("keeps quoted commas inside one address", () => {
    const parsed = parseAddressHeader(
      '"Lovelace, Ada" <ada@example.com>, Bob <bob@example.com>'
    );
    assert.deepEqual(
      parsed.map((a) => a.email),
      ["ada@example.com", "bob@example.com"]
    );
    assert.equal(parsed[0]?.name, "Lovelace, Ada");
  });
});

describe("externalRecipients", () => {
  it("drops Jason and noise, keeps the person on Cc", () => {
    const people = externalRecipients(
      "Jason <jason@kupermanadvisors.com>, noreply@sendgrid.net",
      "Ada <ada@example.com>"
    );
    assert.deepEqual(people, [{ name: "Ada", email: "ada@example.com" }]);
  });
});

describe("recipientLine", () => {
  it("clips after three names", () => {
    assert.equal(
      recipientLine([
        { name: "A", email: "a@x.com" },
        { name: null, email: "b@x.com" },
        { name: "C", email: "c@x.com" },
        { name: "D", email: "d@x.com" },
      ]),
      "A, b@x.com, C +1"
    );
  });
});

describe("qualifySentMessage", () => {
  it("accepts a sent message with an outside recipient", () => {
    const result = qualifySentMessage({
      labelIds: ["SENT"],
      subject: "Proposal",
      to: "Ada <ada@example.com>",
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.toLine, "Ada");
  });

  it("rejects drafts, calendar invites, and mail only to Jason", () => {
    assert.equal(
      qualifySentMessage({
        labelIds: ["DRAFT", "SENT"],
        to: "Ada <ada@example.com>",
      }).ok,
      false
    );
    assert.equal(
      qualifySentMessage({
        labelIds: ["SENT"],
        subject: "Invitation: Lunch",
        to: "Ada <ada@example.com>",
      }).ok,
      false
    );
    assert.equal(
      qualifySentMessage({
        labelIds: ["SENT"],
        subject: "Note to self",
        to: "jason@kupermanadvisors.com",
      }).ok,
      false
    );
  });
});

describe("follow-up dates", () => {
  it("adds whole calendar days from today", () => {
    assert.equal(followUpDueYmd("2026-09-24", 1), "2026-09-25");
    assert.equal(followUpDueYmd("2026-09-24", 3), "2026-09-27");
    assert.equal(followUpDueYmd("2026-09-24", 5), "2026-09-29");
    assert.equal(followUpDueYmd("2026-09-24", 0), null);
    assert.equal(followUpDueYmd("2026-09-24", 400), null);
  });

  it("is due on the day and overdue after it", () => {
    assert.equal(isFollowupDue("2026-09-24", "2026-09-24"), true);
    assert.equal(isFollowupDue("2026-09-25", "2026-09-24"), false);
    assert.equal(followupDaysOverdue("2026-09-22", "2026-09-24"), 2);
    assert.equal(followupDaysOverdue("2026-09-24", "2026-09-24"), 0);
  });
});

describe("planSentFollowupUpsert", () => {
  it("inserts a thread we have not seen", () => {
    assert.equal(planSentFollowupUpsert(undefined, hit()).action, "insert");
  });

  it("leaves a decided thread alone when the same send syncs again", () => {
    assert.deepEqual(
      planSentFollowupUpsert(
        {
          threadId: "t1",
          messageId: "m1",
          sentAt: "2026-09-20T15:00:00.000Z",
          status: "scheduled",
        },
        hit()
      ),
      { action: "skip", threadId: "t1" }
    );
  });

  it("reopens a decided thread when a newer email goes out", () => {
    const plan = planSentFollowupUpsert(
      {
        threadId: "t1",
        messageId: "m1",
        sentAt: "2026-09-20T15:00:00.000Z",
        status: "dismissed",
      },
      hit({ messageId: "m2", sentAt: "2026-09-22T15:00:00.000Z" })
    );
    assert.equal(plan.action, "reopen");
  });

  it("refreshes an undecided row in place", () => {
    const plan = planSentFollowupUpsert(
      {
        threadId: "t1",
        messageId: "m1",
        sentAt: "2026-09-20T15:00:00.000Z",
        status: "new",
      },
      hit({ messageId: "m2", sentAt: "2026-09-21T15:00:00.000Z" })
    );
    assert.equal(plan.action, "refresh");
  });
});

describe("latestHitPerThread", () => {
  it("keeps the newest send in a thread", () => {
    const latest = latestHitPerThread([
      hit({ messageId: "old", sentAt: "2026-09-01T00:00:00.000Z" }),
      hit({ messageId: "new", sentAt: "2026-09-10T00:00:00.000Z" }),
      hit({ threadId: "t2", messageId: "other" }),
    ]);
    assert.equal(latest.length, 2);
    assert.equal(latest.find((row) => row.threadId === "t1")?.messageId, "new");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sentReplyPatch } from "./sent-reply";

describe("sent reply detection", () => {
  it("marks a reply-ready handoff as waiting once mail was sent", () => {
    const patch = sentReplyPatch({
      status: "draft_ready",
      callStartsAt: null,
      contactEmail: "jane@example.com",
      outreach: { subject: "Re: intro", sentAt: "2026-10-08T15:00:00.000Z" },
    });
    assert.deepEqual(patch, {
      status: "acted_on",
      last_outreach_subject: "Re: intro",
      last_outreach_sent_at: "2026-10-08T15:00:00.000Z",
    });
  });

  it("marks times_ready the same way", () => {
    const patch = sentReplyPatch({
      status: "times_ready",
      callStartsAt: null,
      contactEmail: "jane@example.com",
      outreach: { subject: null, sentAt: "2026-10-08T15:00:00.000Z" },
    });
    assert.equal(patch?.status, "acted_on");
  });

  it("leaves waiting, booked, and no-email rows alone", () => {
    assert.equal(
      sentReplyPatch({
        status: "acted_on",
        callStartsAt: null,
        contactEmail: "jane@example.com",
        outreach: { subject: "Re: intro", sentAt: "2026-10-08T15:00:00.000Z" },
      }),
      null
    );
    assert.equal(
      sentReplyPatch({
        status: "draft_ready",
        callStartsAt: "2026-10-10T15:00:00.000Z",
        contactEmail: "jane@example.com",
        outreach: { subject: "Re: intro", sentAt: "2026-10-08T15:00:00.000Z" },
      }),
      null
    );
    assert.equal(
      sentReplyPatch({
        status: "draft_ready",
        callStartsAt: null,
        contactEmail: null,
        outreach: { subject: "Re: intro", sentAt: "2026-10-08T15:00:00.000Z" },
      }),
      null
    );
    assert.equal(
      sentReplyPatch({
        status: "draft_ready",
        callStartsAt: null,
        contactEmail: "jane@example.com",
        outreach: null,
      }),
      null
    );
  });
});

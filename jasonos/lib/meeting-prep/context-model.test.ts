import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  gmailThreadUrl,
  groupCommunicationHistory,
  linkify,
  meetingContextLine,
  repairGmailUrl,
  type HistoryTouch,
} from "./context-model.ts";

const GMAIL = "https://mail.google.com/mail/u/jason%40kupermanadvisors.com/#all/1a11264b966d935c";

function touch(partial: Partial<HistoryTouch> & Pick<HistoryTouch, "id" | "touchedAt">): HistoryTouch {
  return {
    contactId: "c1",
    channel: "email",
    source: "gmail",
    direction: "outbound",
    subject: "Hello",
    brief: "Note",
    threadUrl: GMAIL,
    ...partial,
  };
}

describe("groupCommunicationHistory", () => {
  it("folds email rows that share a thread link and keeps LinkedIn on its own", () => {
    const entries = groupCommunicationHistory([
      touch({ id: "1", touchedAt: "2026-10-06T18:05:46Z", subject: "Matt/Jason Connect" }),
      touch({ id: "2", touchedAt: "2026-10-06T20:10:59Z", direction: "inbound", subject: "Re: Matt/Jason Connect" }),
      touch({ id: "3", touchedAt: "2026-10-06T20:53:40Z", subject: "Re: Matt/Jason Connect" }),
      touch({ id: "4", touchedAt: "2026-10-06T22:22:09Z", direction: "inbound", subject: "Re: Matt/Jason Connect" }),
      touch({ id: "5", touchedAt: "2026-10-06T23:29:47Z", subject: "Re: Matt/Jason Connect", brief: "Great - updated invite sent!" }),
      touch({
        id: "6",
        touchedAt: "2026-09-23T21:08:01Z",
        channel: "text",
        source: "beeper",
        subject: "Matt Ramerman",
        brief: "Sent text via LinkedIn: Hi Matt",
        threadUrl: null,
      }),
    ]);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].channelLabel, "Gmail");
    assert.equal(entries[0].messageCount, 5);
    assert.equal(entries[0].title, "Re: Matt/Jason Connect");
    assert.equal(entries[1].channelLabel, "LinkedIn");
    assert.equal(entries[1].messageCount, 1);
  });
});

describe("gmail and profile links", () => {
  it("keeps @ in the Gmail mailbox so the thread opens", () => {
    assert.equal(
      gmailThreadUrl("jskuperman@gmail.com", "1a0ceea9a0d11bab"),
      "https://mail.google.com/mail/u/jskuperman@gmail.com/#all/1a0ceea9a0d11bab"
    );
    assert.equal(
      repairGmailUrl("https://mail.google.com/mail/u/jason%40kupermanadvisors.com/#all/abc"),
      "https://mail.google.com/mail/u/jason@kupermanadvisors.com/#all/abc"
    );
  });

  it("turns a LinkedIn address in a sentence into a link", () => {
    const parts = linkify(
      "Matt Ramerman. LinkedIn https://www.linkedin.com/in/ramerman. Phone (206) 399-3559."
    );
    assert.deepEqual(
      parts.filter((part) => part.href),
      [{ text: "https://www.linkedin.com/in/ramerman", href: "https://www.linkedin.com/in/ramerman" }]
    );
  });
});

describe("meetingContextLine", () => {
  it("names the Browning intro, threads, LinkedIn, and last contact", () => {
    const line = meetingContextLine(
      {
        touchCount: 9,
        emailThreadCount: 3,
        lastContactAt: "2026-10-06T23:29:47Z",
        lastContactChannel: "Gmail",
        hasBrowningIntro: true,
        hasLinkedIn: true,
      },
      "2026-10-09T16:00:00Z"
    );
    assert.equal(
      line,
      "Intro from Tracy (Browning) · 3 email threads · LinkedIn message · last contact Oct 6"
    );
  });

  it("says when JasonOS has nothing", () => {
    assert.equal(
      meetingContextLine(
        {
          touchCount: 0,
          emailThreadCount: 0,
          lastContactAt: null,
          lastContactChannel: null,
          hasBrowningIntro: false,
          hasLinkedIn: false,
        },
        "2026-10-09T16:00:00Z"
      ),
      "No history in JasonOS."
    );
  });
});

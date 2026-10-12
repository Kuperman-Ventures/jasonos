import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeMeetingBrief,
  gmailThreadUrl,
  groupCommunicationHistory,
  linkify,
  meetingContextLine,
  repairGmailUrl,
  type HistoryTouch,
  type MeetingContextConnection,
  type MeetingContextPerson,
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
      "https://mail.google.com/mail/?authuser=jskuperman%40gmail.com#all/1a0ceea9a0d11bab"
    );
    assert.equal(
      repairGmailUrl("https://mail.google.com/mail/u/jason%40kupermanadvisors.com/#all/abc"),
      "https://mail.google.com/mail/?authuser=jason%40kupermanadvisors.com#all/abc"
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

describe("composeMeetingBrief", () => {
  it("pulls relationship summary, commitments, and Browning ask into one brief", () => {
    const people = [
      {
        contactId: "c1",
        email: "a@b.com",
        name: "Alex",
        title: null,
        company: null,
        linkedinUrl: null,
        relationshipType: null,
        intent: null,
        networkRole: null,
        notes: null,
        personalGoal: null,
        phone: null,
        referredByName: null,
        researchLead: null,
        researchBullets: [],
        researchEmpty: true,
        browningPrep: null,
        openCommitments: [
          { text: "Send intro to Sam", direction: "mine" as const, status: "open", due: "2026-10-15" },
        ],
        remember: ["Kid just started college"],
        helped: ["Warm intro to Tracy"],
        topics: ["search"],
        nextMove: "Confirm times this week",
        relationshipSummary: "Alex replied after Tracy's intro and wants a short call.",
      },
    ] satisfies MeetingContextPerson[];
    const connections = [
      {
        id: "h1",
        subject: "Intro",
        receivedAt: null,
        whyTheyReplied: null,
        ask: "Find mutual overlap",
        who: null,
        why: null,
        overlap: null,
        questions: ["What are you hunting?"],
        meetingBrief: null,
        emailUrl: null,
        attachmentLabel: "Resume",
      },
    ] satisfies MeetingContextConnection[];
    const brief = composeMeetingBrief({ people, connections });
    assert.match(brief.summary ?? "", /Alex replied/);
    assert.equal(brief.nextMove, "Confirm times this week");
    assert.equal(brief.commitments.length, 1);
    assert.equal(brief.remember[0], "Kid just started college");
    assert.ok(brief.provenance.includes("Relationship brief · Alex"));
    assert.ok(brief.provenance.includes("Browning introduction"));
  });
});

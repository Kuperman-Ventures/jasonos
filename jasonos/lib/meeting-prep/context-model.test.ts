import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMeetingBriefing,
  composeMeetingBrief,
  displayTouchText,
  enrichPeopleFromTouches,
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
        directTouchCount: 2,
        lastTouchAt: "2026-10-06T23:29:47Z",
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
        attachmentUrl: "/api/browning-networking/resume?contactId=c1",
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

describe("displayTouchText", () => {
  it("drops quoted replies, signatures, and links so the sentence is readable", () => {
    const text = displayTouchText(
      "Thanks Jason, much better thank you! 3pm Thursday UK time would be ideal. Please do also invite ian - ian@myartbroker.com Looking forward C Charlotte Stewart Managing Director +44 (0) 7792 208660"
    );
    assert.equal(
      text,
      "Thanks Jason, much better thank you! 3pm Thursday UK time would be ideal. Please do also invite ian - ian@myartbroker.com"
    );
    assert.equal(
      displayTouchText("That&#39;s great. On Sep 11, 2026, at 7:30 AM, Charlotte wrote: > older"),
      "That's great."
    );
    assert.equal(
      displayTouchText(
        "Jason, Meet Charlotte Stewart<https://www.linkedin.com/in/charlotte-stewart-775a35a1/> and Ian Syer, MD and CEO of MyArtBroker<https://www.myartbroker.c"
      )?.includes("<"),
      false
    );
  });
});

describe("buildMeetingBriefing", () => {
  it("pulls where it stands, the intro, and what you already said you'd cover", () => {
    const people = [
      { contactId: "charlotte", name: "Charlotte Stewart", email: "charlotte@myartbroker.com" },
      { contactId: "ian", name: "Ian Syer", email: "ian@myartbroker.com" },
      { contactId: "clive", name: "Clive Punter", email: "clive@upworking.com" },
    ];
    const briefing = buildMeetingBriefing({
      title: "Charlotte, Ian and Jason: Precision Marketing",
      people,
      touches: [
        touch({
          id: "cal",
          contactId: "clive",
          channel: "calendar",
          touchedAt: "2026-10-06T14:00:00Z",
          subject: "Jason Kuperman and Clive Punter",
          brief: "Jason Kuperman and Clive Punter",
          threadUrl: null,
        }),
        touch({
          id: "stake",
          contactId: "clive",
          touchedAt: "2026-09-01T23:55:14Z",
          subject: "Re: Following up on today's call — observations and next steps",
          brief:
            "From my review (vs actual data or client conversations) I would start with: 1) After using the valuation tool, what is the follow-up with the high-intent prospect 2) Artist pages",
        }),
        touch({
          id: "intro",
          contactId: "clive",
          direction: "inbound",
          touchedAt: "2026-09-03T15:12:44Z",
          subject: "Charlotte, Ian and Jason: Precision Marketing",
          brief:
            "Jason, Meet Charlotte Stewart<https://www.linkedin.com/in/charlotte-stewart-775a35a1/> and Ian Syer<https://www.linkedin.com/in/ian-syer-8a4a0423/>, MD and CEO of MyArtBroker<https://www.myartbroker.com>",
        }),
        touch({
          id: "schedule",
          contactId: "charlotte",
          touchedAt: "2026-09-11T11:47:09Z",
          subject: "Re: Charlotte, Ian and Jason: Precision Marketing",
          brief: "Oh no, I hope everything goes smoothly. I can do Tuesday or Friday next week at the same time.",
        }),
        touch({
          id: "latest",
          contactId: "charlotte",
          direction: "inbound",
          touchedAt: "2026-10-09T11:23:12Z",
          subject: "Re: Charlotte, Ian and Jason: Precision Marketing",
          brief:
            "Thanks Jason, much better thank you! 3pm Thursday UK time would be ideal. Please do also invite ian - ian@myartbroker.com Looking forward C Charlotte Stewart Managing Director",
        }),
        touch({
          id: "latest-copy",
          contactId: "ian",
          direction: "inbound",
          touchedAt: "2026-10-09T11:23:12Z",
          subject: "Re: Charlotte, Ian and Jason: Precision Marketing",
          brief:
            "Thanks Jason, much better thank you! 3pm Thursday UK time would be ideal. Please do also invite ian - ian@myartbroker.com Looking forward C Charlotte Stewart Managing Director",
          threadUrl: null,
        }),
      ],
    });

    assert.match(briefing.whereItStands?.text ?? "", /3pm Thursday UK time/);
    assert.equal(briefing.whereItStands?.name, "Charlotte Stewart");
    assert.match(briefing.introduction?.text ?? "", /Meet Charlotte Stewart and Ian Syer, MD and CEO of MyArtBroker/);
    assert.equal(briefing.introduction?.name, "Clive Punter");
    assert.match(briefing.yourStake?.text ?? "", /valuation tool/);
    assert.equal(briefing.yourStake?.direction, "outbound");
    assert.equal(briefing.meetingThread?.messageCount, 3);
    assert.equal(briefing.meetingThread?.schedulingCount, 2);
    assert.equal(briefing.otherThreads.length, 1);
    assert.match(briefing.otherThreads[0].title, /Following up/);
    assert.equal(briefing.otherThreads[0].preview, null);
  });
});

describe("enrichPeopleFromTouches", () => {
  it("fills company and LinkedIn from the intro note without overwriting stored values", () => {
    const base = {
      email: "",
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
      openCommitments: [],
      remember: [],
      helped: [],
      topics: [],
      nextMove: null,
      relationshipSummary: null,
      directTouchCount: 0,
      lastTouchAt: null,
    } satisfies Omit<MeetingContextPerson, "contactId" | "name" | "email">;
    const people: MeetingContextPerson[] = [
      { ...base, contactId: "charlotte", name: "Charlotte Stewart", email: "charlotte@myartbroker.com" },
      { ...base, contactId: "ian", name: "Ian Syer", email: "ian@myartbroker.com" },
      {
        ...base,
        contactId: "clive",
        name: "Clive Punter",
        email: "clive@upworking.com",
        company: "UpWorking",
        linkedinUrl: "https://www.linkedin.com/in/clive",
      },
    ];
    const enriched = enrichPeopleFromTouches(people, [
      touch({
        id: "intro",
        contactId: "clive",
        direction: "inbound",
        touchedAt: "2026-09-03T15:12:44Z",
        subject: "Charlotte, Ian and Jason: Precision Marketing",
        brief:
          "Jason, Meet Charlotte Stewart<https://www.linkedin.com/in/charlotte-stewart-775a35a1/> and Ian Syer<https://www.linkedin.com/in/ian-syer-8a4a0423/>, MD and CEO of MyArtBroker",
      }),
    ]);
    assert.equal(enriched[0].company, "MyArtBroker");
    assert.equal(enriched[0].linkedinUrl, "https://www.linkedin.com/in/charlotte-stewart-775a35a1/");
    assert.equal(enriched[1].company, "MyArtBroker");
    assert.equal(enriched[1].linkedinUrl, "https://www.linkedin.com/in/ian-syer-8a4a0423/");
    assert.equal(enriched[2].company, "UpWorking");
    assert.equal(enriched[2].linkedinUrl, "https://www.linkedin.com/in/clive");
  });
});

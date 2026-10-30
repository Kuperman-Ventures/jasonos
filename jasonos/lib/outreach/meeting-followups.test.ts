import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attendeeLine,
  fillMeetingFollowupPrompt,
  firstName,
  guessFollowupDisplayName,
  hasWrongMeetingDayLanguage,
  isHollowFollowupBody,
  isMeetingFollowupDue,
  isMeetingPastForFollowup,
  isUnacceptableFollowupBody,
  expandSentTouchesAcrossContactAliases,
  latestSentByEmail,
  looksLikeGranolaNoteFragment,
  meetingEndIso,
  meetingFollowupDraft,
  meetingHasKnownContact,
  meetingWhenPhrase,
  notesLookLikeFirstMeeting,
  pendingAttendeesForMeeting,
  pickMeetingFollowupFacts,
  planMeetingFollowup,
  qualifyMeetingAttendees,
  qualifyPastMeeting,
  resolveMeetingFollowupPrompt,
  snoozeUntilYmd,
  soundsLikePitchFollowup,
  soundsLikeWrongReconnect,
  type PastMeetingCandidate,
} from "./meeting-followups";

const meeting = (
  overrides: Partial<PastMeetingCandidate> = {}
): PastMeetingCandidate => ({
  gcalEventId: "ev1",
  icalUid: "uid1",
  title: "Catch up",
  startsAt: "2026-09-20T15:00:00.000Z",
  endsAt: "2026-09-20T15:30:00.000Z",
  calendarUrl: "https://calendar.google.com/event?eid=1",
  attendees: [{ name: "Ada Lovelace", email: "ada@example.com" }],
  ...overrides,
});

describe("qualifyMeetingAttendees", () => {
  it("drops Jason, noise, and duplicates", () => {
    const people = qualifyMeetingAttendees([
      { email: "jason@kupermanadvisors.com", name: "Jason" },
      { email: "noreply@sendgrid.net", name: "Bot" },
      { email: "ada@example.com", name: "Ada" },
      { email: "Ada@example.com", name: "Ada 2" },
      { email: "room@resource.calendar.google.com", name: "Room" },
    ]);
    assert.deepEqual(people, [{ email: "ada@example.com", name: "Ada" }]);
  });
});

describe("meetingEndIso", () => {
  it("uses dateTime end, and all-day exclusive end", () => {
    assert.equal(
      meetingEndIso({ end: { dateTime: "2026-09-20T15:30:00-04:00" } }),
      new Date("2026-09-20T15:30:00-04:00").toISOString()
    );
    const allDay = meetingEndIso({ end: { date: "2026-09-21" } });
    assert.ok(allDay);
    assert.ok(Date.parse(allDay) < Date.parse("2026-09-21T00:00:00.000Z"));
  });
});

describe("isMeetingPastForFollowup", () => {
  it("waits for the grace window after the meeting ends", () => {
    const endsAt = "2026-09-20T15:30:00.000Z";
    assert.equal(
      isMeetingPastForFollowup(endsAt, new Date("2026-09-20T15:40:00.000Z")),
      false
    );
    assert.equal(
      isMeetingPastForFollowup(endsAt, new Date("2026-09-20T15:45:00.000Z")),
      true
    );
  });
});

describe("pendingAttendeesForMeeting", () => {
  it("keeps attendees with no post-meeting email", () => {
    const sent = latestSentByEmail([
      { email: "ada@example.com", sentAt: "2026-09-20T14:00:00.000Z" },
      { email: "bob@example.com", sentAt: "2026-09-20T16:00:00.000Z" },
    ]);
    const pending = pendingAttendeesForMeeting(
      [
        { email: "ada@example.com", name: "Ada" },
        { email: "bob@example.com", name: "Bob" },
      ],
      "2026-09-20T15:30:00.000Z",
      sent
    );
    assert.deepEqual(pending, [{ email: "ada@example.com", name: "Ada" }]);
  });

  it("clears a calendar guest when Jason emailed another address on the same contact", () => {
    const sent = expandSentTouchesAcrossContactAliases(
      latestSentByEmail([
        {
          email: "andrew.romano@strategiesforwealth.com",
          sentAt: "2026-09-30T21:39:12.000Z",
        },
      ]),
      (email) =>
        email.includes("romano") || email.includes("guardian")
          ? [
              "andrew.romano@strategiesforwealth.com",
              "strategiesforwealth8@guardianlife.com",
            ]
          : []
    );
    const pending = pendingAttendeesForMeeting(
      [
        {
          email: "strategiesforwealth8@guardianlife.com",
          name: "Andrew Romano",
        },
      ],
      "2026-09-30T20:00:00.000Z",
      sent
    );
    assert.deepEqual(pending, []);
  });
});

describe("planMeetingFollowup", () => {
  const sent = latestSentByEmail([]);
  const today = "2026-09-22";

  it("inserts when someone still needs mail", () => {
    const plan = planMeetingFollowup(meeting(), sent, undefined, today);
    assert.equal(plan.action, "insert");
  });

  it("resolves an open row once everyone was emailed", () => {
    const after = latestSentByEmail([
      { email: "ada@example.com", sentAt: "2026-09-20T16:00:00.000Z" },
    ]);
    const plan = planMeetingFollowup(
      meeting(),
      after,
      { gcalEventId: "ev1", status: "open", snoozeUntil: null },
      today
    );
    assert.deepEqual(plan, {
      action: "resolve",
      gcalEventId: "ev1",
      reason: "emailed",
    });
  });

  it("does not reopen done or dismissed rows", () => {
    const plan = planMeetingFollowup(
      meeting(),
      sent,
      { gcalEventId: "ev1", status: "done", snoozeUntil: null },
      today
    );
    assert.equal(plan.action, "skip");
  });

  it("keeps snooze until the day arrives", () => {
    const plan = planMeetingFollowup(
      meeting(),
      sent,
      { gcalEventId: "ev1", status: "snoozed", snoozeUntil: "2026-09-25" },
      today
    );
    assert.equal(plan.action, "refresh");
    if (plan.action === "refresh") {
      assert.equal(plan.status, "snoozed");
      assert.equal(plan.snoozeUntil, "2026-09-25");
    }
  });
});

describe("qualifyPastMeeting", () => {
  it("rejects cancelled, future, and oversized guest lists", () => {
    assert.equal(
      qualifyPastMeeting({
        gcalEventId: "ev1",
        status: "cancelled",
        startsAt: "2026-09-01T12:00:00.000Z",
        endsAt: "2026-09-01T13:00:00.000Z",
        guests: [{ email: "ada@example.com" }],
        hasKnownContact: true,
        now: new Date("2026-09-22T12:00:00.000Z"),
      }),
      null
    );
    assert.equal(
      qualifyPastMeeting({
        gcalEventId: "ev1",
        startsAt: "2026-09-22T18:00:00.000Z",
        endsAt: "2026-09-22T19:00:00.000Z",
        guests: [{ email: "ada@example.com" }],
        hasKnownContact: true,
        now: new Date("2026-09-22T12:00:00.000Z"),
      }),
      null
    );
  });

  it("rejects large no-contact meetings (webinars)", () => {
    assert.equal(
      qualifyPastMeeting({
        gcalEventId: "ev1",
        startsAt: "2026-09-01T12:00:00.000Z",
        endsAt: "2026-09-01T13:00:00.000Z",
        guests: [
          { email: "a@example.com" },
          { email: "b@example.com" },
          { email: "c@example.com" },
          { email: "d@example.com" },
        ],
        knownEmails: new Set(["ada@example.com"]),
        now: new Date("2026-09-22T12:00:00.000Z"),
      }),
      null
    );
    assert.ok(
      qualifyPastMeeting({
        gcalEventId: "ev1",
        startsAt: "2026-09-01T12:00:00.000Z",
        endsAt: "2026-09-01T13:00:00.000Z",
        guests: [{ email: "ada@example.com", name: "Ada" }],
        knownEmails: new Set(["ada@example.com"]),
        now: new Date("2026-09-22T12:00:00.000Z"),
      })
    );
  });

  it("keeps small meetings whose invitees are not in People yet", () => {
    const meeting = qualifyPastMeeting({
      gcalEventId: "ev-new",
      startsAt: "2026-09-01T12:00:00.000Z",
      endsAt: "2026-09-01T13:00:00.000Z",
      guests: [
        { email: "pat@new.co", name: "Pat New" },
        { email: "sam@new.co", name: "Sam New" },
      ],
      knownEmails: new Set(["ada@example.com"]),
      now: new Date("2026-09-22T12:00:00.000Z"),
    });
    assert.ok(meeting);
    assert.equal(meeting?.attendees.length, 2);
    assert.equal(meeting?.attendees[0]?.email, "pat@new.co");
  });
});

describe("meetingHasKnownContact", () => {
  it("matches canonical emails", () => {
    assert.equal(
      meetingHasKnownContact(
        [{ email: "ada@example.com", name: "Ada" }],
        new Set(["ada@example.com"])
      ),
      true
    );
    assert.equal(
      meetingHasKnownContact(
        [{ email: "other@example.com", name: "Other" }],
        new Set(["ada@example.com"])
      ),
      false
    );
  });
});

describe("helpers", () => {
  it("formats attendee lines and keeps the local draft free of note paste", () => {
    assert.equal(
      attendeeLine([
        { name: "Ada", email: "a@x.com" },
        { name: null, email: "b@x.com" },
        { name: "C", email: "c@x.com" },
        { name: "D", email: "d@x.com" },
      ]),
      "Ada, b@x.com, C +1"
    );
    const note =
      "Shawn to reciprocate with relevant introductions (Shawn) Committed to looking through his network for people useful to Jason.";
    const draft = meetingFollowupDraft({
      name: "Shawn Example",
      title: "Catch up",
      summary: note,
    });
    assert.match(draft.subject, /good talking|catching up/i);
    assert.match(draft.body, /^Shawn,/);
    assert.equal(/\breconnect\b/i.test(draft.body), false);
    assert.equal(draft.body.includes(note), false);
    assert.equal(draft.body.includes("(Shawn)"), false);
    assert.equal(looksLikeGranolaNoteFragment(note), true);
    assert.equal(
      isUnacceptableFollowupBody(
        `Hi,\n\nThanks again for the conversation. ${note}\n\nJason`,
        note
      ),
      true
    );
    assert.equal(
      isUnacceptableFollowupBody(
        `Shawn,\n\nThanks for the conversation. Good to hear you'll look through your network for useful intros. I'll do the same on my side.\n\nJason`,
        note
      ),
      false
    );
    assert.equal(snoozeUntilYmd("2026-09-22", 3), "2026-09-25");
    assert.equal(isMeetingFollowupDue("open", null, "2026-09-22"), true);
    assert.equal(isMeetingFollowupDue("snoozed", "2026-09-25", "2026-09-22"), false);
    assert.equal(isMeetingFollowupDue("snoozed", "2026-09-22", "2026-09-22"), true);
  });
});

describe("firstName", () => {
  it("handles First Last and Last, First", () => {
    assert.equal(firstName("Tuomas Peltoniemi"), "Tuomas");
    assert.equal(firstName("Peltoniemi, Tuomas"), "Tuomas");
    assert.equal(firstName("Matthew Deutsch"), "Matthew");
    assert.equal(firstName(null), "there");
  });
});

describe("guessFollowupDisplayName", () => {
  it("pulls Simon from title or email when guest name is missing", () => {
    assert.equal(
      guessFollowupDisplayName({
        name: null,
        email: "simon@betaevolution.com.au",
        title: "Jason K/ Simon B Catch-Up II [if you can make this]",
      }),
      "Simon"
    );
    assert.equal(
      guessFollowupDisplayName({
        name: null,
        email: "simon@betaevolution.com.au",
        title: "Quick sync",
      }),
      "Simon"
    );
    assert.equal(
      guessFollowupDisplayName({
        name: "Tuomas Peltoniemi",
        email: "x@y.com",
        title: "Catch up",
      }),
      "Tuomas"
    );
  });
});

describe("soundsLikePitchFollowup", () => {
  it("flags Equity Labs / thesis pivots after a catch-up", () => {
    assert.equal(
      soundsLikePitchFollowup(
        "Peltoniemi,\n\nGood to reconnect. I'll keep Equity Labs in mind given Accenture's role as a major implementer there; worth a more targeted conversation.\n\nJason"
      ),
      true
    );
    assert.equal(
      soundsLikePitchFollowup(
        "Tuomas,\n\nIt was so good to catch up after all these years. Hard to believe it has been a decade since the TBWA days.\n\nJason"
      ),
      false
    );
  });
});

describe("meetingWhenPhrase", () => {
  it("labels today / yesterday / last week correctly in ET", () => {
    assert.equal(
      meetingWhenPhrase("2026-09-30T16:00:00.000Z", "2026-09-30"),
      "today"
    );
    assert.equal(
      meetingWhenPhrase("2026-09-29T16:00:00.000Z", "2026-09-30"),
      "yesterday"
    );
    assert.equal(
      meetingWhenPhrase("2026-09-23T16:00:00.000Z", "2026-09-30"),
      "last week"
    );
    assert.equal(
      meetingWhenPhrase("2026-09-28T16:00:00.000Z", "2026-09-30"),
      "earlier this week"
    );
  });
});

describe("hasWrongMeetingDayLanguage", () => {
  it("flags today-language when the meeting was last week", () => {
    assert.equal(
      hasWrongMeetingDayLanguage(
        "Tuomas,\n\nIt was good to talk to you today.\n\nJason",
        "last week"
      ),
      true
    );
    assert.equal(
      hasWrongMeetingDayLanguage(
        "Tuomas,\n\nIt was good to catch up last week.\n\nJason",
        "last week"
      ),
      false
    );
    assert.equal(
      hasWrongMeetingDayLanguage(
        "Tuomas,\n\nGood talking today.\n\nJason",
        "today"
      ),
      false
    );
  });
});

describe("isHollowFollowupBody", () => {
  it("flags empty reconnect fluff", () => {
    assert.equal(
      isHollowFollowupBody(
        "Hi,\n\nIt was good to reconnect last week. Thanks again for the conversation.\n\nJason"
      ),
      true
    );
    assert.equal(
      isHollowFollowupBody(
        "Hardik,\n\nIt was good to reconnect today. Thanks again for the conversation.\n\nJason"
      ),
      true
    );
    assert.equal(
      isHollowFollowupBody(
        "Tobias,\n\nGood talking earlier this week. Thanks again for the conversation.\n\nJason"
      ),
      true
    );
    assert.equal(
      isHollowFollowupBody(
        "Tuomas,\n\nIt was good to catch up last week. I liked hearing how Accenture is approaching the Equity Labs work — especially the implementer angle.\n\nLet's not wait another decade.\n\nJason"
      ),
      false
    );
  });
});

describe("pickMeetingFollowupFacts", () => {
  it("prefers their brand/work over Jason bio lines", () => {
    const facts = pickMeetingFollowupFacts(
      `# Tobias Background
- Engineer by training, career in marketing
# Setsu (Cosmetics Brand)
- Co-founded via Gloss Ventures; hero product is a neckliner
# Jason's Background and Current Focus
- Architecture degree, moved into digital after AutoCAD
- Launched Kuperman Advisors
# Next Steps
- Review Tobias's LinkedIn connections and suggest introductions`
    );
    assert.ok(facts.some((f) => /setsu|neckliner|gloss/i.test(f)));
    assert.ok(!facts.some((f) => /kuperman advisors|architecture degree/i.test(f)));
  });
});

describe("meetingFollowupDraft with notes", () => {
  it("includes a concrete takeaway when notes have substance", () => {
    const draft = meetingFollowupDraft({
      name: "Tobias Topel",
      title: "Intro - Tobias X Jason",
      summary:
        "Setsu cosmetics brand. Co-founded via Gloss Ventures; hero product is a neckliner. On track past $100M revenue.",
      startsAt: "2026-10-28T21:00:00.000Z",
    });
    assert.equal(isHollowFollowupBody(draft.body), false);
    assert.match(draft.body, /setsu|neckliner|gloss|100m/i);
    assert.doesNotMatch(draft.body, /thanks again for the conversation/i);
  });
});

describe("notesLookLikeFirstMeeting", () => {
  it("treats missing notes and intro language as first meetings", () => {
    assert.equal(notesLookLikeFirstMeeting(null), true);
    assert.equal(
      notesLookLikeFirstMeeting(
        "About Hardik. Franchise locations. Great to meet you. Send franchise contacts."
      ),
      true
    );
    assert.equal(
      notesLookLikeFirstMeeting(
        "Jason and Tuomas catching up after ~10 years, last connected during TBWA days"
      ),
      false
    );
  });
});

describe("soundsLikeWrongReconnect", () => {
  it("rejects reconnect wording on a first-meeting note", () => {
    const hardikNotes =
      "About Hardik. Owns Subway and Tropical Smoothie. Great to meet you. Send franchise contacts and QSR samples.";
    assert.equal(
      soundsLikeWrongReconnect(
        "Hardik,\n\nIt was good to reconnect today. Thanks again for the conversation.\n\nJason",
        hardikNotes
      ),
      true
    );
    assert.equal(
      soundsLikeWrongReconnect(
        "Hardik,\n\nGood talking today. I'll send those franchise contacts and the QSR samples.\n\nJason",
        hardikNotes
      ),
      false
    );
  });
});

describe("meetingFollowupDraft first meeting", () => {
  it("does not say reconnect when notes are missing or look like an intro", () => {
    const empty = meetingFollowupDraft({
      name: "Hardik Patel",
      title: "Meeting with Jason",
      summary: null,
      startsAt: "2026-10-12T18:00:00.000Z",
    });
    assert.equal(/\breconnect\b/i.test(empty.body), false);
    assert.match(empty.body, /^Hardik,/);
    assert.match(empty.subject, /good talking/i);

    const first = meetingFollowupDraft({
      name: "Hardik Patel",
      title: "Meeting with Jason",
      summary:
        "About Hardik. Franchise consulting. Great to meet you. Send franchise contacts.",
      startsAt: "2026-10-12T18:00:00.000Z",
    });
    assert.equal(/\breconnect\b/i.test(first.body), false);
  });
});

describe("resolveMeetingFollowupPrompt", () => {
  it("fills placeholders and falls back to default", () => {
    const filled = fillMeetingFollowupPrompt(
      "Open with {{greeting}}. Meeting was {{whenPhrase}}. Hi {{firstName}}.",
      { firstName: "Tuomas", greeting: "Tuomas,", whenPhrase: "last week" }
    );
    assert.equal(
      filled,
      "Open with Tuomas,. Meeting was last week. Hi Tuomas."
    );
    assert.ok(resolveMeetingFollowupPrompt(null).includes("DATE AWARENESS"));
    assert.ok(
      resolveMeetingFollowupPrompt(null).includes("FIRST MEETING vs RECONNECT")
    );
    assert.ok(resolveMeetingFollowupPrompt("  Custom rules  ").startsWith("Custom"));
  });
});

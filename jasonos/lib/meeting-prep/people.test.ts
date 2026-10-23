import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACTIVITY_LOG_COLUMNS,
  CARRY_HINT,
  activityLogCsv,
  activityLogFilename,
  callOfThree,
  carryDiscussNext,
  comparePeople,
  countSecondCalls,
  countsAsFirstContact,
  heldOfThree,
  isOverdueNext,
  isPast48h,
  nextContactTone,
  nextPlaybookFamily,
  nextPlaybookLabel,
  thankYouState,
  weeklyActivityCounts,
  type SortablePerson,
} from "./people.ts";

const NOW = Date.parse("2026-10-23T16:00:00Z");

describe("isPast48h", () => {
  it("flags a referral with no first contact after 48 hours", () => {
    assert.equal(
      isPast48h({ status: "referral", referralReceivedAt: "2026-10-21T15:00:00Z", firstContactAt: null }, NOW),
      true
    );
  });

  it("waits out the 48 hours", () => {
    assert.equal(
      isPast48h({ status: "referral", referralReceivedAt: "2026-10-21T17:00:00Z", firstContactAt: null }, NOW),
      false
    );
  });

  it("clears once contacted or past referral", () => {
    const received = "2026-10-01T12:00:00Z";
    assert.equal(isPast48h({ status: "referral", referralReceivedAt: received, firstContactAt: received }, NOW), false);
    assert.equal(isPast48h({ status: "first_contacted", referralReceivedAt: received, firstContactAt: null }, NOW), false);
    assert.equal(isPast48h({ status: "referral", referralReceivedAt: null, firstContactAt: null }, NOW), false);
  });
});

describe("next contact", () => {
  it("is overdue only before today", () => {
    assert.equal(isOverdueNext("2026-10-22", "2026-10-23"), true);
    assert.equal(isOverdueNext("2026-10-23", "2026-10-23"), false);
    assert.equal(isOverdueNext(null, "2026-10-23"), false);
  });

  it("is magenta only for a late referral, yellow inside 14 days or overdue", () => {
    assert.equal(nextContactTone({ past48h: true, nextContact: null, todayYmd: "2026-10-23" }), "magenta");
    assert.equal(nextContactTone({ past48h: false, nextContact: "2026-11-06", todayYmd: "2026-10-23" }), "yellow");
    assert.equal(nextContactTone({ past48h: false, nextContact: "2026-10-01", todayYmd: "2026-10-23" }), "yellow");
    assert.equal(nextContactTone({ past48h: false, nextContact: "2026-11-07", todayYmd: "2026-10-23" }), null);
    assert.equal(nextContactTone({ past48h: false, nextContact: null, todayYmd: "2026-10-23" }), null);
  });
});

describe("call labels", () => {
  it("counts held calls out of three", () => {
    assert.equal(callOfThree(0), "No calls yet");
    assert.equal(callOfThree(2), "Call 2 of 3");
    assert.equal(callOfThree(4), "Call 4");
    assert.equal(heldOfThree(1), "Call 1 of 3 held");
    assert.equal(heldOfThree(0), "No calls held");
  });
});

describe("comparePeople", () => {
  const row = (name: string, patch: Partial<SortablePerson> = {}): SortablePerson => ({
    name,
    overdue48h: false,
    overdueNext: false,
    nextContact: null,
    ...patch,
  });

  it("puts late referrals, then overdue, then next date, then no date", () => {
    const sorted = [
      row("No date"),
      row("Later", { nextContact: "2026-11-20" }),
      row("Overdue", { overdueNext: true, nextContact: "2026-10-01" }),
      row("Soon", { nextContact: "2026-10-30" }),
      row("Late referral", { overdue48h: true }),
    ].sort(comparePeople);
    assert.deepEqual(
      sorted.map((item) => item.name),
      ["Late referral", "Overdue", "Soon", "Later", "No date"]
    );
  });
});

describe("nextPlaybookFamily", () => {
  it("uses First Call before any call is held", () => {
    assert.equal(nextPlaybookFamily("referral", 0), "net102_first");
    assert.equal(nextPlaybookFamily("first_contacted", 0), "net102_first");
    assert.equal(nextPlaybookLabel("referral", 0), "Net 102 First Call");
  });

  it("uses Second Call after one held call and after", () => {
    assert.equal(nextPlaybookFamily("call_1", 1), "net102_second");
    assert.equal(nextPlaybookLabel("call_1", 1), "Net 102 Second Call");
    assert.equal(nextPlaybookFamily("call_2", 2), "net102_second");
    assert.equal(nextPlaybookFamily("ongoing", 5), "net102_second");
  });
});

describe("carryDiscussNext", () => {
  const why = [
    { label: "Why this person", text: "Runs partnerships", sourceHint: null },
    { label: "Why someone in their network", text: "", sourceHint: null },
    { label: "Why are we talking again", text: "", sourceHint: null },
  ];

  it("fills the empty third Why line", () => {
    const lines = carryDiscussNext(why, "  Her Q1 hiring plan ");
    assert.equal(lines?.[2].text, "Her Q1 hiring plan");
    assert.equal(lines?.[2].sourceHint, CARRY_HINT);
    assert.equal(lines?.[0].text, "Runs partnerships");
  });

  it("leaves a written third line and empty input alone", () => {
    const written = why.map((line, index) => (index === 2 ? { ...line, text: "Already said" } : line));
    assert.equal(carryDiscussNext(written, "Her Q1 hiring plan"), null);
    assert.equal(carryDiscussNext(why, "  "), null);
    assert.equal(carryDiscussNext(why.slice(0, 2), "Plan"), null);
  });
});

describe("countsAsFirstContact", () => {
  const received = "2026-10-20T12:00:00Z";

  it("counts outbound email, LinkedIn and any call after the referral", () => {
    for (const channel of ["email", "linkedin", "phone", "calendar"]) {
      assert.equal(
        countsAsFirstContact({ channel, direction: "outbound", touchedAt: "2026-10-21T12:00:00Z", referralReceivedAt: received }),
        true,
        channel
      );
    }
    assert.equal(
      countsAsFirstContact({ channel: "calendar", direction: "inbound", touchedAt: "2026-10-21T12:00:00Z", referralReceivedAt: received }),
      true
    );
  });

  it("ignores inbound mail, thank-yous and touches before the referral", () => {
    assert.equal(
      countsAsFirstContact({ channel: "email", direction: "inbound", touchedAt: "2026-10-21T12:00:00Z", referralReceivedAt: received }),
      false
    );
    assert.equal(
      countsAsFirstContact({ channel: "thank_you_note", direction: "outbound", touchedAt: "2026-10-21T12:00:00Z", referralReceivedAt: received }),
      false
    );
    assert.equal(
      countsAsFirstContact({ channel: "email", direction: "outbound", touchedAt: "2026-10-19T12:00:00Z", referralReceivedAt: received }),
      false
    );
  });
});

describe("thankYouState", () => {
  it("reads sent, due and late", () => {
    assert.equal(thankYouState({ sentAt: "2026-10-22T10:00:00Z", dueAt: null }, NOW).kind, "sent");
    assert.equal(thankYouState({ sentAt: null, dueAt: "2026-10-24T10:00:00Z" }, NOW).kind, "due");
    assert.equal(thankYouState({ sentAt: null, dueAt: "2026-10-22T10:00:00Z" }, NOW).kind, "late");
    assert.equal(thankYouState({ sentAt: null, dueAt: null }, NOW).kind, "none");
  });
});

describe("weeklyActivityCounts", () => {
  it("counts x of y inside the Browning windows", () => {
    const counts = weeklyActivityCounts({
      referrals: [
        { receivedAt: "2026-10-19T12:00:00Z", firstContactAt: "2026-10-20T12:00:00Z" },
        { receivedAt: "2026-10-19T12:00:00Z", firstContactAt: "2026-10-22T12:00:00Z" },
        { receivedAt: "2026-10-21T12:00:00Z", firstContactAt: null },
      ],
      calls: [
        { endsAt: "2026-10-20T15:00:00Z", thankYouSentAt: "2026-10-21T09:00:00Z", contactsReceived: 2 },
        { endsAt: "2026-10-21T15:00:00Z", thankYouSentAt: "2026-10-23T09:00:00Z", contactsReceived: 1 },
      ],
      secondCallsScheduled: 1,
    });
    assert.deepEqual(counts, {
      referralsReceived: 3,
      firstContactsIn48h: { met: 1, of: 3 },
      callsHeld: 2,
      contactsReceived: 3,
      thankYouIn24h: { met: 1, of: 2 },
      secondCallsScheduled: 1,
    });
  });
});

describe("activityLogCsv", () => {
  it("writes the nine Browning columns and escapes cells", () => {
    const csv = activityLogCsv([
      {
        date: "2026-10-20",
        name: "Molly Millar",
        company: "Horizon, Inc.",
        touchNumber: 1,
        conversation: 'Said "call me in January"\nWants agency intros',
        contactsReceived: [
          { name: "Dana Ruiz", company: "Horizon" },
          { name: "Sam Lee", company: null },
        ],
        followUpWith: [
          { text: "Send my profile", owner: "me" },
          { text: "Intro to Dana", owner: "them" },
        ],
        nextContact: "2026-11-03",
        thankYouSentAt: "2026-10-21T02:00:00Z",
      },
    ]);
    const [header, row] = csv.split("\r\n");
    assert.equal(ACTIVITY_LOG_COLUMNS.length, 9);
    assert.equal(
      header,
      "Date,Name,Company,Call,Conversation,Contacts received,Follow up with,Next contact,Thank-you sent"
    );
    assert.equal(
      row.startsWith('2026-10-20,Molly Millar,"Horizon, Inc.",1,"Said ""call me in January""'),
      true
    );
    assert.match(csv, /Dana Ruiz \(Horizon\); Sam Lee,Me: Send my profile; Them: Intro to Dana,2026-11-03,2026-10-20\r\n$/);
    assert.equal(activityLogFilename("2026-10-19"), "Activity Log 2026-10-19.csv");
  });
});

describe("countSecondCalls", () => {
  it("counts each person once when exactly one call was held before the meeting", () => {
    const logs = [
      { contactId: "c1", prepId: "p0", occurredAt: "2026-10-01T15:00:00Z" },
      { contactId: "c2", prepId: "p1", occurredAt: "2026-10-01T15:00:00Z" },
      { contactId: "c2", prepId: "p2", occurredAt: "2026-10-05T15:00:00Z" },
    ];
    const meetings = [
      { id: "m1", startsAt: "2026-10-20T15:00:00Z", contactId: "c1" },
      { id: "m2", startsAt: "2026-10-21T15:00:00Z", contactId: "c1" },
      { id: "m3", startsAt: "2026-10-20T15:00:00Z", contactId: "c2" },
      { id: "m4", startsAt: "2026-10-20T15:00:00Z", contactId: "c3" },
    ];
    assert.equal(countSecondCalls(meetings, logs), 1);
  });
});

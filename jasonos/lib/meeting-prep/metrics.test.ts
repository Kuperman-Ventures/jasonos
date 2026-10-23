import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CADENCE_RULE,
  computeCallMetrics,
  computeRelationshipMetrics,
  isWithinCadence,
  type MetricMeeting,
} from "./metrics.ts";

function meeting(overrides: Partial<MetricMeeting> = {}): MetricMeeting {
  return {
    id: "m1",
    startsAt: "2026-10-01T15:00:00.000Z",
    primaryContactId: "c1",
    strategyId: "s1",
    outcomeMark: "hit",
    suggestedMark: "hit",
    asksCovered: 1,
    asksTotal: 2,
    ...overrides,
  };
}

describe("computeRelationshipMetrics", () => {
  it("counts a first meeting from touches and a repeat against last touch plus cadence", () => {
    const metrics = computeRelationshipMetrics({
      from: "2026-08-01",
      to: "2026-10-18",
      today: "2026-10-18",
      meetings: [
        meeting({ id: "first", startsAt: "2026-09-01T15:00:00.000Z" }),
        meeting({
          id: "repeat",
          startsAt: "2026-10-01T15:00:00.000Z",
          outcomeMark: "partial",
          suggestedMark: "hit",
        }),
        meeting({
          id: "late",
          startsAt: "2026-10-10T15:00:00.000Z",
          outcomeMark: null,
          suggestedMark: null,
          asksCovered: 0,
          asksTotal: 0,
        }),
      ],
      contacts: [
        {
          id: "c1",
          name: "John",
          company: "Acme",
          cadence: "monthly",
          lastTouchDate: "2026-09-01",
          nextTouchDate: "2026-10-01",
        },
      ],
      touches: [{ contactId: "c1", touchedAt: "2026-09-01T15:00:00.000Z" }],
      commitments: [
        {
          contactId: "c1",
          direction: "theirs",
          status: "open",
          createdAt: "2026-09-15T12:00:00.000Z",
          doneAt: null,
        },
        {
          contactId: "c1",
          direction: "mine",
          status: "done",
          createdAt: null,
          doneAt: "2026-10-02T12:00:00.000Z",
        },
      ],
      strategies: [{ id: "s1", name: "First Call" }],
    });

    assert.equal(metrics.firstMeetings, 1);
    assert.equal(metrics.repeatMeetings, 2);
    assert.equal(metrics.repeatWithinCadence, 1);
    assert.equal(isWithinCadence(meeting({ startsAt: "2026-10-10T15:00:00.000Z" }), {
      id: "c1",
      name: "John",
      company: null,
      cadence: "monthly",
      lastTouchDate: "2026-09-01",
      nextTouchDate: null,
    }), false);
    assert.deepEqual(metrics.commitmentsOpened, { mine: 0, theirs: 1 });
    assert.deepEqual(metrics.commitmentsClosed, { mine: 1, theirs: 0 });
    assert.equal(metrics.commitmentsSince, "2026-09-15");
    assert.deepEqual(metrics.markAgreement, { agree: 1, total: 2 });
    assert.equal(metrics.byStrategy[0].hit, 1);
    assert.equal(metrics.byStrategy[0].partial, 1);
    assert.equal(metrics.byStrategy[0].unmarked, 1);
    assert.equal(metrics.byStrategy[0].asksCovered, 2);
    assert.equal(metrics.byStrategy[0].asksTotal, 4);
    assert.equal(metrics.byPerson[0].meetings, 3);
    assert.equal(metrics.byPerson[0].openTheirs, 1);
    assert.equal(metrics.byPerson[0].openMine, 0);
    assert.equal(metrics.byPerson[0].nextTouchOverdue, true);
    assert.match(CADENCE_RULE, /last touch date plus the cadence interval/);
  });
});

describe("computeCallMetrics", () => {
  it("averages calls per person and contacts per call, and splits asks made from skipped", () => {
    const metrics = computeCallMetrics({
      logs: [
        { contactId: "c1", endsAt: "2026-10-01T16:00:00Z", thankYouSentAt: "2026-10-01T20:00:00Z", contactsReceived: 2 },
        { contactId: "c1", endsAt: "2026-10-08T16:00:00Z", thankYouSentAt: null, contactsReceived: 1 },
        { contactId: "c2", endsAt: "2026-10-09T16:00:00Z", thankYouSentAt: "2026-10-11T16:00:00Z", contactsReceived: 0 },
      ],
      referrals: [
        { receivedAt: "2026-10-01T12:00:00Z", firstContactAt: "2026-10-02T12:00:00Z" },
        { receivedAt: "2026-10-05T12:00:00Z", firstContactAt: null },
      ],
      asks: [{ state: "covered" }, { state: "skipped" }, { state: "covered" }, { state: "open" }],
      secondCallsScheduled: 1,
    });
    assert.equal(metrics.calls, 3);
    assert.equal(metrics.people, 2);
    assert.equal(metrics.touchesPerPerson, 1.5);
    assert.equal(metrics.contactsReceived, 3);
    assert.equal(metrics.contactsPerCall, 1);
    assert.deepEqual(metrics.firstContactIn48h, { met: 1, of: 2 });
    assert.deepEqual(metrics.thankYouIn24h, { met: 1, of: 3 });
    assert.deepEqual(metrics.asks, { made: 2, skipped: 1 });
    assert.equal(metrics.secondCallsScheduled, 1);
  });

  it("returns null averages when nothing was held", () => {
    const metrics = computeCallMetrics({ logs: [], referrals: [], asks: [], secondCallsScheduled: 0 });
    assert.equal(metrics.touchesPerPerson, null);
    assert.equal(metrics.contactsPerCall, null);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CADENCE_RULE,
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

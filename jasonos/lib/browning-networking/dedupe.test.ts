import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displayHandoffName,
  planDuplicateDismissals,
  preferredHandoff,
  sameHandoffPerson,
  type DedupeHandoff,
} from "./dedupe";

const row = (overrides: Partial<DedupeHandoff>): DedupeHandoff => ({
  id: overrides.id ?? "a",
  contactName: overrides.contactName ?? null,
  contactEmail: overrides.contactEmail ?? null,
  existingContactId: overrides.existingContactId ?? null,
  createdContactId: overrides.createdContactId ?? null,
  callStartsAt: overrides.callStartsAt ?? null,
  callEventId: overrides.callEventId ?? null,
  status: overrides.status ?? "acted_on",
  receivedAt: overrides.receivedAt ?? "2026-09-30T12:00:00.000Z",
  createdAt: overrides.createdAt ?? "2026-09-30T12:00:00.000Z",
});

describe("sameHandoffPerson", () => {
  it("matches on email even when names differ slightly", () => {
    assert.equal(
      sameHandoffPerson(
        { contactEmail: "tim@serewicz.com", contactName: "Tim Serewicz" },
        { contactEmail: "Tim@serewicz.com", contactName: "Timothy Serewicz" }
      ),
      true
    );
  });

  it("matches Matt Ramerman name-only to Matt with email once names align", () => {
    assert.equal(
      sameHandoffPerson(
        {
          contactName: "Matt Ramerman",
          contactEmail: null,
          createdContactId: "c1",
        },
        {
          contactName: "Matt Ramerman",
          contactEmail: "matt@ramermancommunications.com",
          existingContactId: "c2",
        }
      ),
      true
    );
  });
});

describe("planDuplicateDismissals", () => {
  it("keeps one Timothy and dismisses the twin", () => {
    const plan = planDuplicateDismissals([
      row({
        id: "old",
        contactName: "Timothy Serewicz",
        contactEmail: "tim@serewicz.com",
        status: "acted_on",
        receivedAt: "2026-09-28T16:00:00.000Z",
      }),
      row({
        id: "new",
        contactName: "Timothy Serewicz",
        contactEmail: "tim@serewicz.com",
        status: "acted_on",
        receivedAt: "2026-09-30T17:00:00.000Z",
      }),
    ]);
    assert.deepEqual(plan.keepIds, ["new"]);
    assert.deepEqual(plan.dismissIds, ["old"]);
  });

  it("groups Matt twins that land on the same calendar event", () => {
    const plan = planDuplicateDismissals([
      row({
        id: "waiting",
        contactName: "Matt Ramerman",
        contactEmail: null,
        status: "acted_on",
        callEventId: "evt-1",
        callStartsAt: "2026-10-06T18:00:00.000Z",
      }),
      row({
        id: "booked",
        contactName: null,
        contactEmail: "matt@ramermancommunications.com",
        status: "booked",
        callStartsAt: "2026-10-06T18:00:00.000Z",
        callEventId: "evt-1",
      }),
    ]);
    assert.deepEqual(plan.keepIds, ["booked"]);
    assert.deepEqual(plan.dismissIds, ["waiting"]);
    assert.equal(plan.merges[0]?.patch.contactName, "Matt Ramerman");
  });

  it("after name enrichment, booked Matt wins and waiting is dismissed", () => {
    const plan = planDuplicateDismissals([
      row({
        id: "waiting",
        contactName: "Matt Ramerman",
        contactEmail: null,
        status: "acted_on",
      }),
      row({
        id: "booked",
        contactName: "Matt Ramerman",
        contactEmail: "matt@ramermancommunications.com",
        status: "booked",
        callStartsAt: "2026-10-06T18:00:00.000Z",
        callEventId: "evt-1",
      }),
    ]);
    assert.deepEqual(plan.keepIds, ["booked"]);
    assert.deepEqual(plan.dismissIds, ["waiting"]);
  });

  it("prefers a row with a future call over acted_on", () => {
    const keep = preferredHandoff(
      row({ id: "a", status: "acted_on" }),
      row({
        id: "b",
        status: "times_ready",
        callStartsAt: "2026-10-06T18:00:00.000Z",
        callEventId: "e",
      })
    );
    assert.equal(keep.id, "b");
  });
});

describe("displayHandoffName", () => {
  it("falls back to email before Unparsed contact", () => {
    assert.equal(
      displayHandoffName({
        contactName: null,
        contactEmail: "matt@ramermancommunications.com",
      }),
      "matt@ramermancommunications.com"
    );
    assert.equal(displayHandoffName({}), "Unparsed contact");
  });
});

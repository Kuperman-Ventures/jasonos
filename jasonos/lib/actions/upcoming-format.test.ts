import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { APP_TZ } from "../dates.ts";
import {
  SCHEDULED_TZ,
  compareUpcoming,
  groupUpcoming,
  scheduledDay,
  upcomingRowWhen,
  type UpcomingItem,
} from "./upcoming-format.ts";

const TODAY = "2026-11-02";

function item(partial: Partial<UpcomingItem> & Pick<UpcomingItem, "id" | "dueOn">): UpcomingItem {
  return {
    area: "Email follow-up",
    subject: partial.subject ?? partial.id,
    detail: null,
    href: null,
    ...partial,
  };
}

describe("scheduled days", () => {
  it("uses the same timezone as the rest of JasonOS", () => {
    assert.equal(SCHEDULED_TZ, APP_TZ);
  });

  it("keeps a calendar day and a midnight UTC value on that day", () => {
    assert.equal(scheduledDay("2026-11-06"), "2026-11-06");
    assert.equal(scheduledDay("2026-11-06T00:00:00.000Z"), "2026-11-06");
  });

  it("converts a real timestamp to the Eastern day", () => {
    assert.equal(scheduledDay("2026-11-04T03:30:00.000Z"), "2026-11-03");
  });
});

describe("upcoming waiting list", () => {
  it("names today, tomorrow, a later day, and an overdue day", () => {
    assert.equal(upcomingRowWhen("2026-11-02", TODAY), "Today");
    assert.equal(upcomingRowWhen("2026-11-03", TODAY), "Tomorrow");
    assert.equal(upcomingRowWhen("2026-11-06", TODAY), "Friday, Nov 6");
    assert.equal(upcomingRowWhen("2026-11-01", TODAY), "1 day overdue");
    assert.equal(upcomingRowWhen("2026-10-30", TODAY), "3 days overdue");
    assert.equal(upcomingRowWhen(null, TODAY), "No date");
  });

  it("puts overdue first, then today, then later days, and groups them", () => {
    const rows = [
      item({ id: "later", dueOn: "2026-11-06", subject: "Later" }),
      item({ id: "today", dueOn: TODAY, subject: "Today" }),
      item({ id: "old", dueOn: "2026-10-30", subject: "Old" }),
      item({ id: "none", dueOn: null, subject: "Undated" }),
      item({ id: "tomorrow", dueOn: "2026-11-03", subject: "Tomorrow" }),
    ];
    assert.deepEqual(rows.slice().sort(compareUpcoming).map((row) => row.id), [
      "old",
      "today",
      "tomorrow",
      "later",
      "none",
    ]);
    const groups = groupUpcoming(rows, TODAY);
    assert.deepEqual(
      groups.map((group) => group.label),
      ["Overdue", "Today", "Tomorrow", "Friday, Nov 6", "No date"]
    );
  });
});

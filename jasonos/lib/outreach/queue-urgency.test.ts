import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { QueueCard } from "./queue-buckets.ts";
import {
  deriveQueueUrgency,
  flattenQueueColumns,
  selectOverdueQueueCards,
  unionScheduleIntoQueueColumns,
} from "./queue-urgency.ts";

const today = "2026-09-15";

function card(partial: Partial<QueueCard> & Pick<QueueCard, "name">): QueueCard {
  return {
    key: partial.key ?? partial.name,
    column: partial.column ?? "network_growth",
    name: partial.name,
    title: null,
    firm: null,
    vip: false,
    relationship_type: null,
    relevance_tier: null,
    network_degree: null,
    primary_email: null,
    phone: null,
    linkedin_url: null,
    cadence_interval: "monthly",
    cadence_stage: "ongoing",
    next_touch_date: partial.next_touch_date ?? null,
    last_touch_date: partial.last_touch_date ?? null,
    reply_status_override: null,
    reply_status_override_at: null,
    reason: "",
    sequenceStageLabel: null,
    contactId: partial.contactId ?? "c1",
    recruiterId: partial.recruiterId ?? null,
  };
}

describe("deriveQueueUrgency", () => {
  it("marks a past next-touch as overdue", () => {
    assert.equal(
      deriveQueueUrgency(
        card({ name: "A", next_touch_date: "2026-09-10" }),
        null,
        today
      ),
      "overdue"
    );
  });

  it("keeps due today in this week, not overdue", () => {
    assert.equal(
      deriveQueueUrgency(
        card({ name: "A", next_touch_date: "2026-09-15" }),
        null,
        today
      ),
      "due_this_week"
    );
  });

  it("parks last-touch-today in engaged, even if next-touch is past", () => {
    assert.equal(
      deriveQueueUrgency(
        card({
          name: "A",
          next_touch_date: "2026-09-10",
          last_touch_date: "2026-09-15",
        }),
        null,
        today
      ),
      "engaged_today"
    );
  });

  it("uses the Schedule due date when the classified card has none", () => {
    assert.equal(
      deriveQueueUrgency(
        card({ name: "A", next_touch_date: null }),
        { nextActionDueDate: "2026-09-01" },
        today
      ),
      "overdue"
    );
  });
});

describe("unionScheduleIntoQueueColumns", () => {
  it("adds a Schedule-only overdue person the classified queue missed", () => {
    const columns = unionScheduleIntoQueueColumns(
      {
        network_growth: [
          card({
            name: "Already queued",
            contactId: "queued",
            next_touch_date: "2026-09-01",
          }),
        ],
        network_maintenance: [],
        browning_cold: [],
      },
      [
        {
          id: "extra",
          contactId: "extra",
          name: "Schedule only",
          title: null,
          firm: null,
          nextActionDueDate: "2026-09-08",
          lastTouch: null,
          source: "cadence",
        },
      ],
      new Map()
    );
    const overdue = selectOverdueQueueCards(columns, new Map(), today);
    assert.equal(overdue.length, 2);
    assert.ok(overdue.some((c) => c.name === "Schedule only"));
    assert.equal(
      overdue.find((c) => c.name === "Schedule only")?.column,
      "network_growth"
    );
  });

  it("does not duplicate a classified person whose Schedule id is the recruiter row", () => {
    const columns = unionScheduleIntoQueueColumns(
      {
        network_growth: [
          card({
            name: "Khurrum",
            contactId: "contact-1",
            recruiterId: "recruiter-1",
            next_touch_date: "2026-08-04",
          }),
        ],
        network_maintenance: [],
        browning_cold: [],
      },
      [
        {
          id: "recruiter-1",
          contactId: "contact-1",
          name: "Khurrum",
          title: null,
          firm: null,
          nextActionDueDate: "2026-08-04",
          lastTouch: null,
          source: "recruiter",
        },
      ],
      new Map()
    );
    assert.equal(flattenQueueColumns(columns).length, 1);
  });

  it("Home overdue matches queue Overdue when unclassified-but-scheduled people exist", () => {
    // Production 2026-09-15: classified queue had 9 Growth + 1 Maintenance.
    // Four more people had a past next-touch but no intent pin and cadence
    // still on initial, so getThreeColumnQueue skipped them. The queue page
    // unioned them from Schedule into Growth (13 + 1). Home used to stop at 10.
    const classified = {
      network_growth: [
        "Khurrum",
        "Matt",
        "Russel",
        "Won-Jin",
        "Jonathan",
        "Michael",
        "Harry",
        "Angus",
        "Barbara",
      ].map((name, i) =>
        card({
          name,
          contactId: `g${i}`,
          next_touch_date: "2026-08-04",
        })
      ),
      network_maintenance: [
        card({
          name: "Marc",
          column: "network_maintenance",
          contactId: "m1",
          next_touch_date: "2026-08-04",
        }),
      ],
      browning_cold: [],
    };

    const homeOnlyClassified = selectOverdueQueueCards(
      classified,
      new Map(),
      today
    );
    assert.equal(homeOnlyClassified.length, 10);

    const extras = ["Mark Boidman", "Bob Jeffrey", "Steve Guberman", "Dorothy Pomerantz"];
    const peopleById = new Map(
      extras.map((name, i) => [
        `u${i}`,
        {
          intent: null,
          cadence_interval: "monthly" as const,
          cadence_stage: i % 2 === 0 ? ("initial" as const) : null,
          next_touch_date: "2026-08-06",
          last_touch_date: null,
        },
      ])
    );
    const columns = unionScheduleIntoQueueColumns(
      classified,
      extras.map((name, i) => ({
        id: `u${i}`,
        contactId: `u${i}`,
        name,
        title: null,
        firm: null,
        nextActionDueDate: "2026-08-06",
        lastTouch: null,
        source: "cadence",
      })),
      peopleById
    );

    const overdue = selectOverdueQueueCards(columns, new Map(), today);
    assert.equal(overdue.length, 14);
    assert.equal(
      overdue.filter((c) => c.column === "network_growth").length,
      13
    );
    assert.equal(
      overdue.filter((c) => c.column === "network_maintenance").length,
      1
    );
    for (const name of extras) {
      assert.ok(overdue.some((c) => c.name === name));
    }
  });
});

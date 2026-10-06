import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  auditDedupeKey,
  buildAuditNetworkingRows,
  nyuiMethodFromChannel,
  type NetworkingContactInput,
  type NetworkingTouchInput,
} from "./audit-networking.ts";

function contact(
  partial: Partial<NetworkingContactInput> & { id: string; name: string }
): NetworkingContactInput {
  return {
    title: null,
    firm: null,
    linkedin_url: null,
    phone: null,
    primary_email: null,
    intent: "network_growth",
    is_networking: true,
    ...partial,
  };
}

function touch(
  partial: Partial<NetworkingTouchInput> & {
    id: string;
    contact_id: string;
    touched_at: string;
  }
): NetworkingTouchInput {
  return {
    channel: "linkedin",
    direction: "outbound",
    brief: null,
    outcome: null,
    ...partial,
  };
}

describe("nyuiMethodFromChannel", () => {
  it("maps JasonOS channels to NYUI contact methods", () => {
    assert.equal(nyuiMethodFromChannel("linkedin"), "LinkedIn");
    assert.equal(nyuiMethodFromChannel("video"), "Video Meeting");
    assert.equal(nyuiMethodFromChannel("coffee_chat"), "In-Person Meeting");
    assert.equal(nyuiMethodFromChannel("email"), "Networking Contact");
  });
});

describe("auditDedupeKey", () => {
  it("strips titles and normalizes case", () => {
    assert.equal(
      auditDedupeKey("2026-04-01", "Ada Lovelace — CTO"),
      auditDedupeKey("2026-04-01", "ada lovelace")
    );
  });
});

describe("buildAuditNetworkingRows", () => {
  const contactsById = new Map<string, NetworkingContactInput>([
    [
      "c1",
      contact({
        id: "c1",
        name: "Ada Lovelace",
        title: "CTO",
        firm: "Analytical Engines",
        linkedin_url: "https://linkedin.com/in/ada",
      }),
    ],
    [
      "c2",
      contact({
        id: "c2",
        name: "Ops Buddy",
        intent: "backrow",
      }),
    ],
    [
      "c3",
      contact({
        id: "c3",
        name: "Grace Hopper",
        firm: "USN",
        phone: "555-0100",
      }),
    ],
  ]);

  it("includes meetings and fresh outreach inside the date range", () => {
    const rows = buildAuditNetworkingRows({
      startDate: "2026-04-01",
      endDate: "2026-04-07",
      contactsById,
      existingTierB: [],
      touches: [
        touch({
          id: "t1",
          contact_id: "c1",
          channel: "video",
          touched_at: "2026-04-02T18:00:00.000Z",
          brief: "Talked roadmap",
        }),
        touch({
          id: "t2",
          contact_id: "c3",
          channel: "linkedin",
          touched_at: "2026-04-03T15:00:00.000Z",
        }),
        // Outside range AND older than the 90-day fresh window
        touch({
          id: "t3",
          contact_id: "c3",
          channel: "linkedin",
          touched_at: "2025-11-01T15:00:00.000Z",
        }),
        // Backrow excluded
        touch({
          id: "t4",
          contact_id: "c2",
          channel: "email",
          touched_at: "2026-04-04T15:00:00.000Z",
        }),
      ],
    });

    assert.equal(rows.length, 2);
    const meeting = rows.find((r) => r.kind === "meeting");
    const outreach = rows.find((r) => r.kind === "fresh_outreach");
    assert.ok(meeting);
    assert.equal(meeting.company_name, "Analytical Engines");
    assert.equal(meeting.contact_method, "Video Meeting");
    assert.match(meeting.contact_person, /Ada Lovelace/);
    assert.equal(meeting.from_networking, true);
    assert.ok(outreach);
    assert.equal(outreach.contact_method, "LinkedIn");
    assert.equal(outreach.company_location, "555-0100");
  });

  it("skips networking rows already covered by a logged Tier B entry", () => {
    const rows = buildAuditNetworkingRows({
      startDate: "2026-04-01",
      endDate: "2026-04-07",
      contactsById,
      existingTierB: [
        { date: "2026-04-02", contact_person: "Ada Lovelace — CTO" },
      ],
      touches: [
        touch({
          id: "t1",
          contact_id: "c1",
          channel: "video",
          touched_at: "2026-04-02T18:00:00.000Z",
        }),
      ],
    });
    assert.equal(rows.length, 0);
  });

  it("prefers a meeting over fresh outreach for the same person/day", () => {
    const rows = buildAuditNetworkingRows({
      startDate: "2026-04-01",
      endDate: "2026-04-07",
      contactsById,
      existingTierB: [],
      touches: [
        touch({
          id: "t1",
          contact_id: "c1",
          channel: "linkedin",
          touched_at: "2026-04-02T14:00:00.000Z",
        }),
        touch({
          id: "t2",
          contact_id: "c1",
          channel: "phone",
          touched_at: "2026-04-02T20:00:00.000Z",
        }),
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].kind, "meeting");
    assert.equal(rows[0].contact_method, "Phone Call");
  });

  it("does not treat follow-up outreach within 90 days as fresh", () => {
    const rows = buildAuditNetworkingRows({
      startDate: "2026-04-01",
      endDate: "2026-04-07",
      contactsById,
      existingTierB: [],
      touches: [
        touch({
          id: "t0",
          contact_id: "c3",
          channel: "email",
          touched_at: "2026-03-20T15:00:00.000Z",
        }),
        touch({
          id: "t1",
          contact_id: "c3",
          channel: "email",
          touched_at: "2026-04-03T15:00:00.000Z",
        }),
      ],
    });
    assert.equal(rows.length, 0);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GrantPatchSchema,
  countByStatus,
  filterGrants,
  isHttpUrl,
  mapColumns,
  nodeRoles,
  slugifyGrantId,
  sortGrants,
  statusRung,
} from "./logic.ts";
import type { ConnectionGrant } from "./types.ts";

function grant(overrides: Partial<ConnectionGrant>): ConnectionGrant {
  return {
    id: "g",
    identity: "jason@kupermanadvisors.com",
    hub: "Zapier",
    target: "Gmail",
    access: "",
    used_by: "",
    status: "unverified",
    evidence: "",
    check_at: "",
    verified_on: null,
    created_at: "2026-10-11T00:00:00Z",
    updated_at: "2026-10-11T00:00:00Z",
    updated_by: "claude",
    ...overrides,
  };
}

describe("slugifyGrantId", () => {
  it("builds a stable lowercase id", () => {
    assert.equal(
      slugifyGrantId({ hub: "Zapier", target: "Google Calendar", identity: "jason@kupermanadvisors.com" }),
      "zapier-google-calendar-jason-kupermanadvisors-com"
    );
  });
});

describe("sortGrants", () => {
  it("puts grants with no use found first", () => {
    const sorted = sortGrants([
      grant({ id: "a", status: "in_use" }),
      grant({ id: "b", status: "no_use_found" }),
      grant({ id: "c", status: "unverified" }),
    ]);
    assert.deepEqual(sorted.map((g) => g.id), ["b", "c", "a"]);
  });
});

describe("filterGrants", () => {
  const rows = [
    grant({ id: "a", hub: "Zapier", target: "HubSpot", status: "in_use" }),
    grant({ id: "b", hub: "Claude connector", target: "Gmail", used_by: "Commitment Check" }),
  ];

  it("filters by status and tool", () => {
    assert.deepEqual(filterGrants(rows, { status: "in_use" }).map((g) => g.id), ["a"]);
    assert.deepEqual(filterGrants(rows, { hub: "Claude connector" }).map((g) => g.id), ["b"]);
  });

  it("searches across what uses the grant", () => {
    assert.deepEqual(filterGrants(rows, { query: "commitment" }).map((g) => g.id), ["b"]);
  });
});

describe("GrantPatchSchema", () => {
  it("returns only the fields that were sent", () => {
    assert.deepEqual(GrantPatchSchema.parse({ status: "in_use" }), { status: "in_use" });
  });

  it("rejects an unknown status", () => {
    assert.throws(() => GrantPatchSchema.parse({ status: "maybe" }));
  });
});

describe("isHttpUrl", () => {
  it("accepts web links and rejects menu paths", () => {
    assert.equal(isHttpUrl("https://zapier.com/app/assets/connections"), true);
    assert.equal(isHttpUrl("Claude app - Scheduled"), false);
  });
});

describe("map helpers", () => {
  const rows = [
    grant({ identity: "a@x.com", hub: "Zapier", target: "Gmail" }),
    grant({ identity: "a@x.com", hub: "Zapier", target: "HubSpot" }),
    grant({ identity: "Claude account", hub: "Google linked app", target: "Zapier" }),
  ];

  it("lists each box once per column", () => {
    const [identities, hubs, targets] = mapColumns(rows);
    assert.deepEqual(identities, ["a@x.com", "Claude account"]);
    assert.deepEqual(hubs, ["Zapier", "Google linked app"]);
    assert.deepEqual(targets, ["Gmail", "HubSpot", "Zapier"]);
  });

  it("reports every column a box appears in", () => {
    assert.deepEqual(nodeRoles(rows, "Zapier"), ["Tool holding access", "App it reaches"]);
  });

  it("counts by status", () => {
    assert.equal(countByStatus(rows).unverified, 3);
  });

  it("maps statuses to JasonOS rungs", () => {
    assert.equal(statusRung("no_use_found"), 1);
    assert.equal(statusRung("in_use"), "ok");
  });
});

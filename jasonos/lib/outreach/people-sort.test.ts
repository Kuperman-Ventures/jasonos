import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { comparePeople } from "./people-sort.ts";

function person(
  name: string,
  extras: Partial<{
    relevance_tier: "A" | "B" | "C" | null;
    network_degree: 1 | 2 | 3 | null;
    created_at: string | null;
  }> = {}
) {
  return {
    name,
    relevance_tier: extras.relevance_tier ?? null,
    network_degree: extras.network_degree ?? null,
    created_at: extras.created_at ?? null,
  };
}

describe("comparePeople added", () => {
  it("puts the newest created_at first", () => {
    const older = person("Ann", { created_at: "2026-01-01T00:00:00Z" });
    const newer = person("Zoe", { created_at: "2026-08-01T00:00:00Z" });
    const list = [older, newer].sort((a, b) => comparePeople(a, b, "added"));
    assert.equal(list[0]?.name, "Zoe");
    assert.equal(list[1]?.name, "Ann");
  });

  it("breaks ties by name", () => {
    const a = person("Ann", { created_at: "2026-08-01T00:00:00Z" });
    const b = person("Bob", { created_at: "2026-08-01T00:00:00Z" });
    const list = [b, a].sort((x, y) => comparePeople(x, y, "added"));
    assert.equal(list[0]?.name, "Ann");
  });

  it("puts missing created_at last", () => {
    const known = person("New", { created_at: "2026-08-01T00:00:00Z" });
    const missing = person("Old import", { created_at: null });
    const list = [missing, known].sort((a, b) => comparePeople(a, b, "added"));
    assert.equal(list[0]?.name, "New");
    assert.equal(list[1]?.name, "Old import");
  });
});

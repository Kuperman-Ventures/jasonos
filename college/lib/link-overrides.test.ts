import assert from "node:assert/strict";
import test from "node:test";
import {
  isOverrideSourceId,
  linkOverrideFor,
  normalizeLinkOverrides,
  setClientLinkOverrides,
  validateOverrideUrl,
  withLinkOverride,
  withNpcOverride,
} from "./link-overrides";

test("validateOverrideUrl accepts https, clears on empty, rejects http and junk", () => {
  assert.deepEqual(validateOverrideUrl("  "), { ok: true, url: null });
  assert.deepEqual(validateOverrideUrl(null), { ok: true, url: null });
  assert.deepEqual(validateOverrideUrl("https://npc.mit.edu/calc"), { ok: true, url: "https://npc.mit.edu/calc" });
  assert.equal(validateOverrideUrl("http://npc.mit.edu").ok, false);
  assert.equal(validateOverrideUrl("npc.mit.edu").ok, false);
  assert.equal(validateOverrideUrl("https://localhost/x").ok, false);
  assert.equal(validateOverrideUrl(42).ok, false);
});

test("only npc and virtual-tours take overrides", () => {
  assert.equal(isOverrideSourceId("npc"), true);
  assert.equal(isOverrideSourceId("virtual-tours"), true);
  assert.equal(isOverrideSourceId("nj-aid"), false);
});

test("normalizeLinkOverrides drops unknown sources and bad URLs", () => {
  const out = normalizeLinkOverrides({
    npc: { mit: "https://a.edu/npc", tufts: "http://b.edu", "": "https://c.edu" },
    "nj-aid": { x: "https://d.gov" },
    "virtual-tours": "nope",
  });
  assert.deepEqual(out, { npc: { mit: "https://a.edu/npc" } });
  assert.deepEqual(normalizeLinkOverrides(null), {});
});

test("withLinkOverride sets and clears without mutating", () => {
  const start = { npc: { mit: "https://a.edu/npc" } };
  const added = withLinkOverride(start, "virtual-tours", "tufts", "https://tour.tufts.edu/");
  assert.deepEqual(added, { npc: { mit: "https://a.edu/npc" }, "virtual-tours": { tufts: "https://tour.tufts.edu/" } });
  const cleared = withLinkOverride(added, "npc", "mit", null);
  assert.deepEqual(cleared, { "virtual-tours": { tufts: "https://tour.tufts.edu/" } });
  assert.deepEqual(start, { npc: { mit: "https://a.edu/npc" } });
});

test("client store feeds linkOverrideFor and withNpcOverride", () => {
  setClientLinkOverrides({ npc: { mit: "https://npc.mit.edu/" }, "virtual-tours": { tufts: "https://t.tufts.edu/" } });
  assert.equal(linkOverrideFor("npc", "mit"), "https://npc.mit.edu/");
  assert.equal(linkOverrideFor("npc", "tufts"), null);
  assert.equal(linkOverrideFor("virtual-tours", "tufts"), "https://t.tufts.edu/");

  const record = { netPriceCalculatorUrl: "https://old.mit.edu/" };
  assert.equal(withNpcOverride(record, "mit")?.netPriceCalculatorUrl, "https://npc.mit.edu/");
  assert.equal(withNpcOverride(record, "tufts"), record);
  assert.equal(withNpcOverride(null, "mit"), null);
  setClientLinkOverrides({});
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildViews,
  deriveItemKey,
  formatDue,
  nextDay,
  parseCommitmentPayload,
  sectionFor,
} from "./logic.ts";
import type { CommitmentItemStateRow } from "./types.ts";

const sample = {
  delivered_count: 2,
  sources: { gmail: "ok", granola: "unavailable" },
  items: [
    {
      promise: "I'll send over a suggested agenda tomorrow",
      to: "Will Duffy",
      due_date: "2026-10-08",
      source: "gmail",
      source_url: "https://mail.google.com/mail/u/0/#all/abc",
      context: "Re: Kickoff",
    },
    { promise: "Share the deck", to: "Richard", due_date: null, source: "granola" },
    { promise: "Draft the brief", to: "Geraint", due_date: "2026-10-13", delivery: "possibly_delivered", evidence: "A draft went out Oct 12." },
  ],
};

describe("parseCommitmentPayload", () => {
  it("fills defaults and derives stable keys", () => {
    const payload = parseCommitmentPayload(JSON.stringify(sample));
    assert.equal(payload.items.length, 3);
    assert.equal(payload.items[0].delivery, "not_delivered");
    assert.equal(payload.sources.granola, "unavailable");
    assert.match(payload.items[0].key, /^gmail:[0-9a-f]{8}$/);
    assert.equal(parseCommitmentPayload(sample).items[0].key, payload.items[0].key);
  });

  it("drops duplicate promises", () => {
    const payload = parseCommitmentPayload({ items: [sample.items[0], { ...sample.items[0] }] });
    assert.equal(payload.items.length, 1);
  });

  it("explains invalid input", () => {
    assert.throws(() => parseCommitmentPayload({ items: [{ promise: "x", to: "y", due_date: "Oct 7" }] }), /due_date/);
    assert.throws(() => parseCommitmentPayload("not json"), /not valid JSON/);
  });

  it("ignores links that are not web links", () => {
    const payload = parseCommitmentPayload({ items: [{ promise: "x", to: "y", source_url: "javascript:alert(1)" }] });
    assert.equal(payload.items[0].source_url, null);
  });
});

describe("sections", () => {
  it("recalculates from today", () => {
    assert.equal(sectionFor("2026-10-08", "2026-10-09"), "overdue");
    assert.equal(sectionFor("2026-10-09", "2026-10-09"), "due_today");
    assert.equal(sectionFor("2026-10-12", "2026-10-09"), "coming_up");
    assert.equal(sectionFor(null, "2026-10-09"), "no_date");
  });
});

describe("buildViews", () => {
  const items = parseCommitmentPayload(sample).items;
  const state = (key: string, s: CommitmentItemStateRow["state"], until: string | null = null): CommitmentItemStateRow => ({
    item_key: key,
    state: s,
    snoozed_until: until,
    note: null,
    updated_at: "",
    updated_by: "jasonos",
  });

  it("hides done items and active snoozes, and orders by section", () => {
    const { visible, hidden } = buildViews(
      items,
      [state(items[0].key, "done"), state(items[2].key, "snoozed", "2026-10-11")],
      "2026-10-10"
    );
    assert.equal(hidden, 2);
    assert.deepEqual(visible.map((v) => v.section), ["no_date"]);
  });

  it("shows a snoozed item again on its snooze date", () => {
    const { visible } = buildViews(items, [state(items[2].key, "snoozed", "2026-10-11")], "2026-10-11");
    assert.deepEqual(visible.map((v) => v.section), ["overdue", "coming_up", "no_date"]);
  });

  it("keeps scheduled items visible with scheduled state", () => {
    const { visible, hidden } = buildViews(
      items,
      [state(items[0].key, "scheduled")],
      "2026-10-10"
    );
    assert.equal(hidden, 0);
    const hit = visible.find((v) => v.key === items[0].key);
    assert.equal(hit?.state, "scheduled");
  });
});

describe("dates", () => {
  it("formats and steps dates", () => {
    assert.equal(nextDay("2026-10-31"), "2026-11-01");
    assert.equal(formatDue("2026-10-07"), "Wed, Oct 7");
    assert.equal(formatDue(null), "No date set");
  });

  it("derives the same key regardless of punctuation", () => {
    assert.equal(
      deriveItemKey({ source: "gmail", source_url: "u", promise: "Send the deck!" }),
      deriveItemKey({ source: "gmail", source_url: "u", promise: "send the deck" })
    );
  });
});

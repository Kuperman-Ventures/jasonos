import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCommitmentOverrides,
  buildViews,
  deriveItemKey,
  formatDue,
  isHandledCommitmentDuplicate,
  nextDay,
  normalizeCommitmentSourceUrl,
  parseCommitmentPayload,
  promiseMostlyContained,
  promiseSimilarity,
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
    promise: null,
    recipient: null,
    source_url: null,
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

  it("puts scheduled items in the Scheduled section", () => {
    const { visible, hidden } = buildViews(
      items,
      [state(items[0].key, "scheduled")],
      "2026-10-10"
    );
    assert.equal(hidden, 0);
    const hit = visible.find((v) => v.key === items[0].key);
    assert.equal(hit?.state, "scheduled");
    assert.equal(hit?.section, "scheduled");
  });
});

describe("applyCommitmentOverrides", () => {
  it("replaces promise, to, and due date without changing the key", () => {
    const items = parseCommitmentPayload(sample).items;
    const edited = applyCommitmentOverrides(items, [
      {
        item_key: items[0].key,
        promise: "I'll send the agenda by Friday",
        to: "Will",
        due_date: "2026-10-10",
      },
      {
        item_key: items[1].key,
        promise: "Share the latest deck",
        to: "Richard",
        due_date: null,
      },
    ]);
    assert.equal(edited[0].key, items[0].key);
    assert.equal(edited[0].promise, "I'll send the agenda by Friday");
    assert.equal(edited[0].to, "Will");
    assert.equal(edited[0].due_date, "2026-10-10");
    assert.equal(edited[1].due_date, null);
    assert.equal(edited[2].promise, items[2].promise);
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

describe("normalizeCommitmentSourceUrl", () => {
  it("canonicalizes Granola note links", () => {
    assert.equal(
      normalizeCommitmentSourceUrl(
        "https://www.notes.granola.ai/d/091C254B-1234-4abc-9def-abcdef012345/extra?x=1"
      ),
      "https://notes.granola.ai/d/091c254b-1234-4abc-9def-abcdef012345"
    );
  });

  it("keeps gmail authuser and drops other query noise", () => {
    assert.equal(
      normalizeCommitmentSourceUrl(
        "https://mail.google.com/mail/u/0/?authuser=1&ui=2#all/abc"
      ),
      "https://mail.google.com/mail/u/0/?authuser=1#all/abc"
    );
    assert.equal(
      normalizeCommitmentSourceUrl(
        "https://mail.google.com/mail/u/0/#all/abc?authuser=1&ui=2"
      ),
      "https://mail.google.com/mail/u/0/?authuser=1#all/abc"
    );
  });

  it("returns null for non-http links", () => {
    assert.equal(normalizeCommitmentSourceUrl("javascript:alert(1)"), null);
  });
});

describe("handled commitment duplicates", () => {
  const granola =
    "https://notes.granola.ai/d/091c254b-1234-4abc-9def-abcdef012345";
  const handled = [
    {
      key: "granola:aaaa1111",
      promise: "Send Jeff the pricing follow-up after the call",
      to: "Jeff",
      source_url: granola,
    },
  ];

  it("scores paraphrase overlap", () => {
    assert.ok(
      promiseSimilarity(
        "Send Jeff the pricing follow-up after the call",
        "I'll send Jeff a pricing follow-up from our call"
      ) >= 0.45
    );
  });

  it("matches same meeting + person when Claude rephrases", () => {
    assert.equal(
      isHandledCommitmentDuplicate(
        {
          key: "granola:bbbb2222",
          promise: "I'll send Jeff a pricing follow-up from our call",
          to: "Jeff",
          source_url: `${granola}?utm=1`,
        },
        handled
      ),
      true
    );
  });

  it("matches strong wording overlap even without a usable URL", () => {
    assert.equal(
      isHandledCommitmentDuplicate(
        {
          key: "granola:cccc3333",
          promise: "Send Jeff the pricing follow-up after the call",
          to: "Jeff",
          source_url: null,
        },
        handled
      ),
      true
    );
  });

  it("does not match a different person or unrelated promise", () => {
    assert.equal(
      isHandledCommitmentDuplicate(
        {
          key: "granola:dddd4444",
          promise: "Book dinner reservations for Friday",
          to: "Lori",
          source_url: granola,
        },
        handled
      ),
      false
    );
  });

  it("matches a short Done snapshot against a longer Claude remint", () => {
    const url = "https://notes.granola.ai/d/54bfae9f-606b-44b8-8f77-6e204ed635f9";
    assert.ok(
      promiseMostlyContained(
        "Introduce Debbie to Lori",
        "Introduce Debbie to Lori to connect on elder-care planning consulting"
      )
    );
    assert.equal(
      isHandledCommitmentDuplicate(
        {
          key: "granola:7ce2d59d",
          promise: "Introduce Debbie to Lori to connect on elder-care planning consulting",
          to: "Lori Selsberg",
          source_url: url,
        },
        [
          {
            key: "granola:98262baf",
            promise: "Introduce Debbie to Lori",
            to: "Lori Selsberg",
            source_url: url,
          },
        ]
      ),
      true
    );
  });

  it("keeps Granola key stable when the URL is canonicalized", () => {
    assert.equal(
      deriveItemKey({
        source: "granola",
        source_url: "https://www.notes.granola.ai/d/091C254B-1234-4abc-9def-abcdef012345?x=1",
        promise: "Send the deck",
      }),
      deriveItemKey({
        source: "granola",
        source_url: "https://notes.granola.ai/d/091c254b-1234-4abc-9def-abcdef012345",
        promise: "Send the deck",
      })
    );
  });
});

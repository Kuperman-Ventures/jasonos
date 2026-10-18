import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adaptSystemPrompt,
  buildAdaptUserMessage,
  parseAdaptation,
  type AdaptInput,
  type AdaptStrategyItem,
} from "./adapt.ts";
import type { Reaction } from "./reactions.ts";

const SHAPES = ["agree", "soft_agree", "defer", "deflect", "counter_ask", "decline"] as const;

function six(): Reaction[] {
  return SHAPES.map((shape) => ({
    shape,
    soundsLike: `${shape} from John.`,
    pivot: "Ask for the intro anyway.",
  }));
}

const strategy: AdaptStrategyItem[] = [
  {
    kind: "question",
    headline: "Still at {{company}}?",
    detail: "Confirm they are still there.",
    prepareReactions: false,
    reactions: [],
  },
  {
    kind: "point",
    headline: "One genuine compliment",
    detail: "Name something specific.",
    prepareReactions: true,
    reactions: six(),
  },
  {
    kind: "question",
    headline: "Still looking?",
    detail: "Ask if the search is open.",
    prepareReactions: false,
    reactions: [],
  },
];

function payload(items: unknown[]) {
  return JSON.stringify({ items });
}

describe("parseAdaptation", () => {
  it("fills a placeholder, keeps a headline, drops with a reason, and allows one extra", () => {
    const parsed = parseAdaptation(
      payload([
        {
          kind: "question",
          headline: "Still at Trident?",
          detail: "You are still at Trident.",
          prepare_reactions: false,
          reactions: [],
          source_hint: "Brief says Trident",
          dropped: false,
          dropped_reason: null,
        },
        {
          kind: "point",
          headline: "One genuine compliment",
          detail: "The brief says he built the payments desk.",
          prepare_reactions: true,
          reactions: six(),
          source_hint: "Relationship brief",
          dropped: false,
        },
        {
          kind: "question",
          headline: "Still looking?",
          detail: "Skip.",
          source_hint: "Brief says he landed at Trident",
          dropped: true,
          dropped_reason: "Brief says he landed at Trident",
        },
        {
          kind: "ask",
          headline: "Ask about the board seat",
          detail: "He told Granola he wants a board seat.",
          source_hint: "Granola note",
          dropped: false,
        },
      ]),
      strategy
    );
    assert.ok(parsed);
    assert.equal(parsed!.length, 4);
    assert.equal(parsed![0].headline, "Still at Trident?");
    assert.equal(parsed![0].sourceHint, "Brief says Trident");
    assert.equal(parsed![1].headline, "One genuine compliment");
    assert.equal(parsed![1].reactions.length, 6);
    assert.equal(parsed![2].dropped, true);
    assert.equal(parsed![2].droppedReason, "Brief says he landed at Trident");
    assert.equal(parsed![3].added, true);
    assert.equal(parsed![3].kind, "ask");
  });

  it("rejects a missing strategy item, a third extra, a bad kind, and bad reactions", () => {
    const kept = [
      {
        kind: "question",
        headline: "Still at {{company}}?",
        detail: "Confirm.",
        source_hint: "Attendee",
      },
      {
        kind: "point",
        headline: "One genuine compliment",
        detail: "Name it.",
        reactions: six(),
        source_hint: "Brief",
      },
    ];
    assert.equal(parseAdaptation(payload(kept), strategy), null);
    assert.equal(
      parseAdaptation(
        payload([
          ...kept,
          { kind: "question", headline: "Still looking?", detail: "Ask.", source_hint: "Purpose" },
          { kind: "point", headline: "Extra one", detail: "A", source_hint: "Brief" },
          { kind: "point", headline: "Extra two", detail: "B", source_hint: "Brief" },
          { kind: "point", headline: "Extra three", detail: "C", source_hint: "Brief" },
        ]),
        strategy
      ),
      null
    );
    assert.equal(
      parseAdaptation(
        payload([
          { kind: "agenda", headline: "Still at {{company}}?", detail: "Confirm." },
          { kind: "point", headline: "One genuine compliment", detail: "Name it.", reactions: six() },
          { kind: "question", headline: "Still looking?", detail: "Ask." },
        ]),
        strategy
      ),
      null
    );
    assert.equal(
      parseAdaptation(
        payload([
          { kind: "question", headline: "Still at {{company}}?", detail: "Confirm." },
          {
            kind: "point",
            headline: "One genuine compliment",
            detail: "Name it.",
            reactions: six().slice(0, 5),
          },
          { kind: "question", headline: "Still looking?", detail: "Ask." },
        ]),
        strategy
      ),
      null
    );
  });

  it("rejects a drop with no reason and an extra with no source", () => {
    assert.equal(
      parseAdaptation(
        payload([
          { kind: "question", headline: "Still at {{company}}?", detail: "Confirm." },
          { kind: "point", headline: "One genuine compliment", detail: "Name it.", reactions: six() },
          { kind: "question", headline: "Still looking?", detail: "Skip.", dropped: true },
        ]),
        strategy
      ),
      null
    );
    assert.equal(
      parseAdaptation(
        payload([
          { kind: "question", headline: "Still at {{company}}?", detail: "Confirm." },
          { kind: "point", headline: "One genuine compliment", detail: "Name it.", reactions: six() },
          { kind: "question", headline: "Still looking?", detail: "Ask." },
          { kind: "point", headline: "Loose point", detail: "No source." },
        ]),
        strategy
      ),
      null
    );
  });

  it("keeps the strategy headline when it has no placeholder", () => {
    const parsed = parseAdaptation(
      payload([
        { kind: "question", headline: "Still at {{company}}?", detail: "Confirm.", source_hint: "Card" },
        {
          kind: "point",
          headline: "One genuine compliment",
          detail: "The payments desk.",
          reactions: six().map((row) => ({
            shape: row.shape,
            sounds_like: row.soundsLike,
            pivot: row.pivot,
          })),
          source_hint: "Brief",
        },
        { kind: "question", headline: "Still looking?", detail: "Ask." },
      ]),
      strategy
    );
    assert.ok(parsed);
    assert.equal(parsed![1].headline, "One genuine compliment");
    assert.equal(parsed![1].reactions[0].soundsLike, "agree from John.");
  });
});

describe("adaptSystemPrompt", () => {
  it("states the rewrite rules and appends the writing rules", () => {
    const prompt = adaptSystemPrompt("No slogans.");
    assert.match(prompt, /at most two/);
    assert.match(prompt, /nothing invented/);
    assert.match(prompt, /No slogans\./);
  });
});

describe("buildAdaptUserMessage", () => {
  it("includes the strategy, live settings, and the person context", () => {
    const input: AdaptInput = {
      strategy: {
        name: "Browning Networking - First Call",
        situation: "First call",
        successSentence: "They offer an intro.",
        rubric: ["Named a person"],
        items: strategy,
      },
      liveSettings: { snapshot: "Operator looking for a COO seat.", targetCompanies: ["Trident"] },
      title: "Trident",
      attendees: [{ name: "John", title: "Partner", company: "Trident" }],
      purpose: "Learn the market",
      outcomeSentence: null,
      summary: "John landed at Trident.",
      nextMove: null,
      openCommitments: [],
      topics: [],
      whereItStands: null,
      yourStake: null,
      introduction: null,
      referrer: "Tracy",
      personalGoal: null,
      projectGoal: "Land a COO role",
      relationshipGoal: "Stay useful to John",
      lastNextStep: null,
      granolaSummaries: [],
      pastMeetings: [],
      jobSearch: [],
    };
    const message = buildAdaptUserMessage(input);
    assert.match(message, /Browning Networking - First Call/);
    assert.match(message, /Still at \{\{company\}\}\?/);
    assert.match(message, /Operator looking for a COO seat/);
    assert.match(message, /Project goal: Land a COO role/);
    assert.match(message, /Goal for this relationship: Stay useful to John/);
    assert.match(message, /Referrer: Tracy/);
  });
});

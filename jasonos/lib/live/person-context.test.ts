import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assemblePersonContext,
  formatPersonDate,
  PERSON_CONTEXT_TOTAL_CAP,
  PERSON_SECTION_ORDER,
  trimPersonContextSections,
  type PersonContextSection,
} from "./person-context.ts";

describe("person-context pure helpers", () => {
  it("formats dates as Mon D, YYYY in Eastern", () => {
    assert.equal(formatPersonDate("2026-10-12"), "Oct 12, 2026");
    assert.equal(formatPersonDate("2026-09-30T17:29:06.672Z"), "Sep 30, 2026");
    assert.equal(formatPersonDate(null), null);
  });

  it("name-only contact produces one section and eight missing", () => {
    const ctx = assemblePersonContext({
      contactId: "c1",
      name: "Ada Example",
    });
    assert.equal(ctx.sections.length, 1);
    assert.equal(ctx.sections[0].key, "who");
    assert.equal(ctx.missing.length, 8);
    assert.deepEqual(
      ctx.missing,
      PERSON_SECTION_ORDER.filter((row) => row.key !== "who").map((row) => row.label)
    );
    assert.match(ctx.text, /^PERSON CONTEXT: Ada Example/);
    assert.match(ctx.text, /Who they are\nName: Ada Example/);
  });

  it("handoff, conversation, and reviewed deck fill sections 3, 6, and 7 with dates", () => {
    const ctx = assemblePersonContext({
      contactId: "c2",
      name: "Brad Test",
      title: "Director",
      companyName: "Acme",
      handoff: {
        whyTheyReplied: "Happy to speak with Jason next week.",
        introReason: "Tracy intro",
      },
      conversations: [
        {
          date: "2026-08-01",
          channel: "phone",
          warmth: 4,
          referralsReceived: 2,
          whatWasHard: "Asking for names",
          whatToDoDifferently: "Lead with the ask sooner",
        },
      ],
      saidCommitted: [
        {
          date: "2026-09-15T15:00:00.000Z",
          said: ["Budget is tight this quarter"],
          committed: ["Send one-pager"],
        },
      ],
    });

    const keys = ctx.sections.map((row) => row.key);
    assert.ok(keys.includes("why_agreed"));
    assert.ok(keys.includes("past"));
    assert.ok(keys.includes("said"));

    const why = ctx.sections.find((row) => row.key === "why_agreed")!;
    assert.match(why.text, /Happy to speak with Jason next week/);

    const past = ctx.sections.find((row) => row.key === "past")!;
    assert.match(past.text, /Aug 1, 2026/);
    assert.match(past.text, /warmth 4/);

    const said = ctx.sections.find((row) => row.key === "said")!;
    assert.match(said.text, /Sep 15, 2026: Budget is tight this quarter/);
    assert.match(said.text, /Sep 15, 2026: committed — Send one-pager/);
  });

  it("total cap trims email, said, past, research in that order", () => {
    const word = "word ";
    const fat = (n: number) => word.repeat(n).trim();
    const sections: PersonContextSection[] = [
      {
        key: "who",
        label: "Who they are",
        text: fat(100),
        words: 100,
        source: "contacts, companies",
      },
      {
        key: "research",
        label: "Research",
        text: fat(500),
        words: 500,
        source: "contacts, companies",
      },
      {
        key: "past",
        label: "Past conversations",
        text: fat(500),
        words: 500,
        source: "browning_conversations, meetings",
      },
      {
        key: "said",
        label: "What they told me before",
        text: fat(500),
        words: 500,
        source: "decks",
      },
      {
        key: "email",
        label: "Recent email",
        text: fat(500),
        words: 500,
        source: "touches",
      },
    ];
    // 2100 already under 2400 — bump who so total exceeds and forces trim chain
    sections[0] = { ...sections[0], text: fat(500), words: 500 };
    const total = sections.reduce((sum, row) => sum + row.words, 0);
    assert.ok(total > PERSON_CONTEXT_TOTAL_CAP);

    // 2500 words: drop email (500) → 2000 under cap; said/past/research stay.
    const trimmed = trimPersonContextSections(sections, PERSON_CONTEXT_TOTAL_CAP);
    const keys = trimmed.map((row) => row.key);
    assert.ok(!keys.includes("email"), "email trimmed first");
    assert.ok(keys.includes("said"));
    assert.ok(keys.includes("past"));
    assert.ok(keys.includes("research"));
    assert.ok(keys.includes("who"));

    // 2900 words: drop email (500) → 2400 exactly, stop. said/past/research stay.
    const deeper = trimPersonContextSections(
      [
        ...sections,
        {
          key: "connected",
          label: "How we are connected",
          text: fat(400),
          words: 400,
          source: "contacts",
        },
      ],
      PERSON_CONTEXT_TOTAL_CAP
    );
    assert.deepEqual(
      deeper.map((row) => row.key).sort(),
      ["connected", "past", "research", "said", "who"].sort()
    );

    // 3700 words: drop email → 3000, said → 2300 under cap; past/research remain.
    const mid = trimPersonContextSections(
      [
        { key: "who", label: "Who they are", text: fat(900), words: 900, source: "contacts" },
        {
          key: "research",
          label: "Research",
          text: fat(700),
          words: 700,
          source: "contacts, companies",
        },
        {
          key: "past",
          label: "Past conversations",
          text: fat(700),
          words: 700,
          source: "browning_conversations, meetings",
        },
        {
          key: "said",
          label: "What they told me before",
          text: fat(700),
          words: 700,
          source: "decks",
        },
        {
          key: "email",
          label: "Recent email",
          text: fat(700),
          words: 700,
          source: "touches",
        },
      ],
      PERSON_CONTEXT_TOTAL_CAP
    );
    assert.deepEqual(
      mid.map((row) => row.key),
      ["who", "research", "past"],
      "trim order email → said"
    );

    // Still over after said: drop past, then research.
    const deepest = trimPersonContextSections(
      [
        { key: "who", label: "Who they are", text: fat(1200), words: 1200, source: "contacts" },
        {
          key: "research",
          label: "Research",
          text: fat(800),
          words: 800,
          source: "contacts, companies",
        },
        {
          key: "past",
          label: "Past conversations",
          text: fat(800),
          words: 800,
          source: "browning_conversations, meetings",
        },
        {
          key: "said",
          label: "What they told me before",
          text: fat(800),
          words: 800,
          source: "decks",
        },
        {
          key: "email",
          label: "Recent email",
          text: fat(800),
          words: 800,
          source: "touches",
        },
      ],
      PERSON_CONTEXT_TOTAL_CAP
    );
    // After email/said/past drops: who 1200 + research 800 = 2000 under cap.
    assert.deepEqual(
      deepest.map((row) => row.key),
      ["who", "research"],
      "trim order email → said → past (research kept once under cap)"
    );

    // Force research drop too.
    const allTrimmed = trimPersonContextSections(
      [
        { key: "who", label: "Who they are", text: fat(2000), words: 2000, source: "contacts" },
        {
          key: "research",
          label: "Research",
          text: fat(800),
          words: 800,
          source: "contacts, companies",
        },
        {
          key: "past",
          label: "Past conversations",
          text: fat(800),
          words: 800,
          source: "browning_conversations, meetings",
        },
        {
          key: "said",
          label: "What they told me before",
          text: fat(800),
          words: 800,
          source: "decks",
        },
        {
          key: "email",
          label: "Recent email",
          text: fat(800),
          words: 800,
          source: "touches",
        },
      ],
      PERSON_CONTEXT_TOTAL_CAP
    );
    assert.deepEqual(allTrimmed.map((row) => row.key), ["who"]);
  });

  it("never invents null fields in who", () => {
    const ctx = assemblePersonContext({
      contactId: "c3",
      name: "Only Name",
      title: null,
      companyName: null,
      linkedinUrl: "  ",
    });
    assert.equal(ctx.sections[0].text, "Name: Only Name");
  });
});

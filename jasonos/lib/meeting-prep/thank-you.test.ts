import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EMPTY_AFTER } from "./after.ts";
import {
  THANK_YOU_MAX_WORDS,
  composeThankYou,
  draftThankYou,
  formatStoredThankYou,
  mailtoHref,
  parseStoredThankYou,
  thankYouParts,
  thankYouSystemPrompt,
  wordCount,
  type ThankYouInput,
} from "./thank-you.ts";

const INPUT: ThankYouInput = {
  prep: {
    title: "Molly Millar / Jason",
    personName: "Molly Millar",
    company: "Horizon Media",
    family: "net102_first",
    topics: ["Agency consolidation", "Who in her network is most connected"],
    helpThem: "I have Browning's network and my own. Tell me who you're trying to reach and I'll see who I know.",
    referrerName: "Tracy",
  },
  afterBlock: {
    template: "Thank you for the time today. We covered [topics].",
    draft: {
      ...EMPTY_AFTER,
      followUpWith: [
        { text: "Send my executive profile", owner: "me" },
        { text: "Intro me to Dana Ruiz", owner: "them" },
      ],
      nextContactAt: "2026-11-06",
    },
  },
  narratives: [],
};

describe("thankYouParts", () => {
  it("has the five networking parts in order", () => {
    const parts = thankYouParts(INPUT);
    assert.deepEqual(
      parts.map((part) => part.key),
      ["thanks", "topics", "actions", "reminders", "useful"]
    );
    assert.equal(parts[0].text, "Thank you for the time today. I'm glad Tracy connected us.");
    assert.equal(parts[1].text, "We covered agency consolidation and who in her network is most connected.");
    assert.equal(parts[2].text, "I'm going to send my executive profile.");
    assert.equal(parts[3].text, "You mentioned you'd intro me to Dana Ruiz.");
  });

  it("uses the interview structure for Int 101", () => {
    const parts = thankYouParts({
      ...INPUT,
      prep: { ...INPUT.prep, family: "int101", role: "CMO", referrerName: null, helpThem: null },
    });
    assert.deepEqual(
      parts.map((part) => part.label),
      ["Thank you for the interview", "What stood out", "Why I fit", "What I'll send", "Next step"]
    );
    assert.match(parts[0].text, /CMO role at Horizon Media/);
  });

  it("writes square-bracket placeholders when the log is empty", () => {
    const parts = thankYouParts({
      ...INPUT,
      prep: { ...INPUT.prep, topics: [], helpThem: null, referrerName: null },
      afterBlock: { template: null, draft: EMPTY_AFTER },
    });
    assert.equal(parts[1].text, "We covered [topics].");
    assert.equal(parts[2].text, "I'm going to [actions].");
    assert.match(parts[4].text, /^\[/);
  });
});

describe("composeThankYou", () => {
  it("greets by first name, signs off as Jason, and stays under 150 words", () => {
    const draft = composeThankYou(INPUT);
    assert.equal(draft.subject, "Thank you, Molly");
    assert.match(draft.body, /^Molly,\n\n/);
    assert.match(draft.body, /\n\nJason$/);
    assert.ok(wordCount(draft.body) <= THANK_YOU_MAX_WORDS);
    assert.ok(!draft.body.includes("—"));
  });
});

describe("draftThankYou", () => {
  it("keeps a model draft that parses and fits", async () => {
    const draft = await draftThankYou(INPUT, {
      generate: async () => '{"subject":"Thanks, Molly","body":"Molly,\\n\\nThanks for today.\\n\\nJason"}',
    });
    assert.equal(draft.drafted, "model");
    assert.equal(draft.subject, "Thanks, Molly");
  });

  it("falls back to the template when the model runs long", async () => {
    const long = Array.from({ length: 200 }, () => "word").join(" ");
    const draft = await draftThankYou(INPUT, {
      generate: async () => JSON.stringify({ subject: "Hi", body: long }),
    });
    assert.equal(draft.drafted, "template");
    assert.match(draft.warning ?? "", /150 words/);
  });

  it("names the five parts and the writing rules in the prompt", () => {
    const prompt = thankYouSystemPrompt("NO SLOP", "net102_first");
    assert.match(prompt, /1\. Thank you; 2\. Topics; 3\. Actions; 4\. Reminders; 5\. Something useful/);
    assert.match(prompt, /NO SLOP/);
  });
});

describe("stored draft and mailto", () => {
  it("round-trips the stored subject and body", () => {
    const stored = formatStoredThankYou({ subject: "Thank you, Molly", body: "Molly,\n\nThanks.\n\nJason" });
    assert.deepEqual(parseStoredThankYou(stored), { subject: "Thank you, Molly", body: "Molly,\n\nThanks.\n\nJason" });
    assert.deepEqual(parseStoredThankYou("Just a body"), { subject: "", body: "Just a body" });
    assert.equal(parseStoredThankYou(null), null);
  });

  it("encodes the mailto link", () => {
    assert.equal(
      mailtoHref({ to: "molly@example.com", subject: "Thank you, Molly", body: "Line 1\n\nLine 2" }),
      "mailto:molly%40example.com?subject=Thank%20you%2C%20Molly&body=Line%201%0A%0ALine%202"
    );
  });
});

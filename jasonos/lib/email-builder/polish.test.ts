import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_ANSWERS } from "./model.ts";
import {
  fixMidSentencePronounCaps,
  looksLikePastedNotes,
  polishBuilderDraft,
} from "./polish.ts";

const note =
  "We worked together at Chiat/Day and have been in touch from time to time since then - including while I was OUTFRONT in the last 5 or 6 years";

describe("fixMidSentencePronounCaps", () => {
  it("lowercases We after because", () => {
    const body =
      "You came to mind because We worked together at Chiat/Day and have been in touch from time to time since then.";
    assert.equal(
      fixMidSentencePronounCaps(body),
      "You came to mind because we worked together at Chiat/Day and have been in touch from time to time since then."
    );
  });

  it("keeps We at the start of a sentence", () => {
    const body = "We overlapped at Chiat/Day.\n\nWould a short call work?";
    assert.equal(fixMidSentencePronounCaps(body), body);
  });
});

describe("looksLikePastedNotes", () => {
  it("flags a long questionnaire note copied into the body", () => {
    const body = `Hi Russel,\n\nYou came to mind because ${note}.\n\n- Jason`;
    assert.equal(
      looksLikePastedNotes(body, {
        ...DEFAULT_ANSWERS,
        relationship: note,
      }),
      true
    );
  });

  it("allows a short fact like a firm name", () => {
    const body =
      "Hi Russel,\n\nWe overlapped at Chiat/Day and stayed in touch, including the OUTFRONT years.\n\n- Jason";
    assert.equal(
      looksLikePastedNotes(body, {
        ...DEFAULT_ANSWERS,
        relationship: "Chiat/Day",
        detail: "OUTFRONT",
      }),
      false
    );
  });
});

describe("polishBuilderDraft", () => {
  it("drops hope-this-finds-you-well and fixes We", () => {
    const polished = polishBuilderDraft({
      subject: "Catching up",
      body: "Hi Russel,\n\nHope this finds you well. You came to mind because We worked together at Chiat/Day.\n",
    });
    assert.match(polished.body, /because we worked/);
    assert.doesNotMatch(polished.body, /hope this finds you well/i);
  });
});

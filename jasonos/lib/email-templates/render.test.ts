import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getEmailTemplate } from "./templates.ts";
import {
  asClause,
  asEmailSentence,
  copiesNoteWording,
  fitSlotValue,
  restoreBrandCaps,
  renderTemplate,
} from "./render.ts";

const note =
  "We worked together at Chiat/Day and have been in touch from time to time since then - including while I was OUTFRONT in the last 5 or 6 years";

describe("asClause", () => {
  it("lowercases a leading We so it can sit mid-sentence", () => {
    assert.equal(
      asClause("We worked together at Chiat/Day"),
      "we worked together at Chiat/Day"
    );
  });
});

describe("asEmailSentence", () => {
  it("makes notes a standalone sentence", () => {
    assert.equal(
      asEmailSentence("we overlapped at Chiat/Day"),
      "We overlapped at Chiat/Day."
    );
  });
});

describe("copiesNoteWording", () => {
  it("flags a 5-word run from the notes", () => {
    assert.equal(
      copiesNoteWording(
        "You came to mind because we worked together at chiat/day and have spoken recently.",
        note
      ),
      true
    );
  });

  it("allows a rewrite that keeps the firm names", () => {
    assert.equal(
      copiesNoteWording(
        "We overlapped at Chiat/Day and stayed in touch, including the OUTFRONT years.",
        note
      ),
      false
    );
  });
});

describe("restoreBrandCaps", () => {
  it("puts Chiat/Day and OUTFRONT back", () => {
    assert.equal(
      restoreBrandCaps("we overlapped at chiat/day while I was at outfront"),
      "we overlapped at Chiat/Day while I was at OUTFRONT"
    );
  });
});

describe("Short & Clean template", () => {
  it("does not splice reason after because", () => {
    const tmpl = getEmailTemplate("option-04-short-clean");
    assert.ok(tmpl);
    assert.equal(tmpl.bodyTemplate.includes("because {{reason}}"), false);
    const body = renderTemplate(tmpl.bodyTemplate, {
      name: "Russel",
      reason: fitSlotValue(
        "We overlapped at Chiat/Day and stayed in touch.",
        "sentence"
      ),
    });
    assert.match(body, /We overlapped at Chiat\/Day/);
    assert.doesNotMatch(body, /because We /);
    assert.doesNotMatch(body, /because we overlapped/i);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFallbackIntroFollowup,
  parseIntroFollowupDraft,
  resolveIntroFollowupDraft,
} from "./followup-draft.ts";
import { INTRO_FOLLOWUP_RULES } from "./strategy.ts";

const input = {
  name: "Rob Peskind",
  firstName: "Rob",
  connectorName: "Jeff Kellick",
  title: "CEO",
  company: "Peskind Executive Search",
  why: "Rob runs an executive search firm focused on venture-backed tech.",
  ask: "Ask Jeff for an intro",
  lane: "job_search",
};

describe("INTRO_FOLLOWUP_RULES", () => {
  it("keeps the follow-up aimed at the introduced person", () => {
    assert.match(INTRO_FOLLOWUP_RULES, /FROM Jason TO the person/);
    assert.match(INTRO_FOLLOWUP_RULES, /connector already made the introduction/i);
    assert.match(INTRO_FOLLOWUP_RULES, /Ask for a short call/);
  });
});

describe("parseIntroFollowupDraft", () => {
  it("parses strict JSON", () => {
    const parsed = parseIntroFollowupDraft(
      '{"subject":"Thanks","body":"Hi Rob,\\n\\nThanks for connecting.\\n\\n- Jason"}'
    );
    assert.equal(parsed?.subject, "Thanks");
    assert.match(parsed?.body ?? "", /Hi Rob/);
    assert.match(parsed?.body ?? "", /- Jason/);
  });

  it("repairs JSON when the body has raw newlines", () => {
    const parsed = parseIntroFollowupDraft(`{
  "subject": "Thanks for connecting",
  "body": "Hi Rob,

Thanks for connecting - Jeff made the introduction.

- Jason"
}`);
    assert.ok(parsed);
    assert.match(parsed.body, /Hi Rob/);
    assert.match(parsed.body, /Jeff made the introduction/);
  });

  it("accepts a plain email when JSON is missing", () => {
    const parsed = parseIntroFollowupDraft(`Subject: Thanks for the intro

Hi Rob,

Thanks for connecting - Jeff made the introduction.

Open to 20 minutes?

- Jason`);
    assert.ok(parsed);
    assert.equal(parsed.subject, "Thanks for the intro");
    assert.match(parsed.body, /^Hi Rob,/);
  });
});

describe("resolveIntroFollowupDraft", () => {
  it("falls back when the model text is unusable", () => {
    const draft = resolveIntroFollowupDraft("not json at all", input);
    assert.equal(draft.source, "fallback");
    assert.match(draft.body, /Hi Rob,/);
    assert.match(draft.body, /Jeff Kellick/);
    assert.match(draft.body, /- Jason/);
  });

  it("prefers a repaired AI draft over the fallback", () => {
    const draft = resolveIntroFollowupDraft(
      `{
  "subject": "Good to connect",
  "body": "Hi Rob,

Jeff connected us. Worth 20 minutes?

- Jason"
}`,
      input
    );
    assert.equal(draft.source, "ai");
    assert.equal(draft.subject, "Good to connect");
    assert.match(draft.body, /Jeff connected us/);
  });
});

describe("buildFallbackIntroFollowup", () => {
  it("builds a concrete note from the why line", () => {
    const draft = buildFallbackIntroFollowup(input);
    assert.match(draft.subject, /Jeff Kellick/);
    assert.match(draft.body, /executive search firm/);
    assert.match(draft.body, /CMO and SVP Marketing/);
  });
});

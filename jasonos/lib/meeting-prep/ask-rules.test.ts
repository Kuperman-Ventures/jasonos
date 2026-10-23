import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ASK_NOTE_IF,
  ASK_NOTE_WHAT_WHEN,
  ASK_NOTE_WHO,
  checkAsk,
  requestSentence,
} from "./ask-rules.ts";

describe("checkAsk", () => {
  it("passes the Net 102 First Call radar ask", () => {
    const ask =
      "Given your years in [industry], you're probably more plugged in than I am to who's doing what. Who would you at least suggest I put on my radar right now?";
    assert.deepEqual(checkAsk(ask), { ok: true, notes: [] });
  });

  it("passes the who-knows-someone pivot from The Ask and Why", () => {
    assert.deepEqual(checkAsk("Who do you know that knows someone at [target company]?"), {
      ok: true,
      notes: [],
    });
  });

  it("passes the Second Call named-connection puzzle", () => {
    const ask =
      "I noticed you're connected to [name] at [company]. That's a place I think I could add value. How well do you know them?";
    assert.deepEqual(checkAsk(ask), { ok: true, notes: [] });
  });

  it("passes the Net 101 tell-me-about ask", () => {
    const ask = "I'm focused on Disney, Netflix. I saw you're connected to [name]. Tell me about them.";
    assert.deepEqual(checkAsk(ask), { ok: true, notes: [] });
  });

  it("flags an if ask and asks for a time on the intro", () => {
    const result = checkAsk("If you know anyone at Google, could you introduce me?");
    assert.equal(result.ok, false);
    assert.deepEqual(result.notes, [ASK_NOTE_IF, ASK_NOTE_WHAT_WHEN]);
  });

  it("flags 'Do you know anybody' even with a relative who", () => {
    const result = checkAsk("Do you know anybody who is hiring?");
    assert.deepEqual(result.notes, [ASK_NOTE_WHO, ASK_NOTE_WHAT_WHEN]);
  });

  it("flags a hiring question as having no who and no object", () => {
    const result = checkAsk("Is your company hiring?");
    assert.deepEqual(result.notes, [ASK_NOTE_WHO, ASK_NOTE_WHAT_WHEN]);
  });

  it("flags the deflect pivot: yes/no intro with no date", () => {
    const result = checkAsk("I'd like that. Would you be willing to introduce us?");
    assert.deepEqual(result.notes, [ASK_NOTE_WHO, ASK_NOTE_WHAT_WHEN]);
  });

  it("asks for a date when a who ask requests an intro", () => {
    assert.deepEqual(checkAsk("Who could introduce me to someone at Acme?").notes, [ASK_NOTE_WHAT_WHEN]);
    assert.deepEqual(checkAsk("Who could introduce me to someone at Acme this month?"), {
      ok: true,
      notes: [],
    });
  });

  it("passes a which ask with an object and a time", () => {
    assert.deepEqual(
      checkAsk("So which of your clients would be worth a call with me next week?"),
      { ok: true, notes: [] }
    );
  });
});

describe("requestSentence", () => {
  it("picks the last question", () => {
    assert.equal(requestSentence("I saw your post. Who should I call? Thanks."), "Who should I call?");
  });
});

describe("checkAsk on empty text", () => {
  it("returns no notes and is not ok", () => {
    assert.deepEqual(checkAsk("  "), { ok: false, notes: [] });
  });
});

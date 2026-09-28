import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { meetingBrief } from "./meeting-brief";
import { HANDOFF_OPENING } from "./types";

describe("meeting brief", () => {
  it("keeps Tracy's note and resume lines, and drops the boilerplate", () => {
    const brief = meetingBrief({
      name: "Matthew Deutsch",
      whyTheyReplied: "I replied because your note on commercialization matched our work.",
      tracyBody: `${HANDOFF_OPENING} with Jason Kuperman.
You two should talk. Matthew has been commercializing a product, and you can compare notes on who is hiring GTM leaders.
(551) 427-6711
-----Original Message-----
From: Matthew Deutsch <deutsch74@gmail.com>
I replied because your note on commercialization matched our work.`,
      resumeText: `Matthew Deutsch
deutsch74@gmail.com
VP Marketing, Northline 2019-2024
Built the go-to-market team from four people to twenty.
Launched a retail media offer with the sales lead.`,
    });
    assert.ok(brief);
    assert.match(brief ?? "", /Matthew Deutsch/);
    assert.match(brief ?? "", /From Tracy/);
    assert.match(brief ?? "", /who is hiring GTM leaders/);
    assert.match(brief ?? "", /Resume/);
    assert.match(brief ?? "", /go-to-market team/);
    assert.doesNotMatch(brief ?? "", /Thank you for your reply/);
    assert.doesNotMatch(brief ?? "", /551/);
  });

  it("reads Tracy's note when Outlook returns it as HTML", () => {
    const brief = meetingBrief({
      name: "Matthew Deutsch",
      whyTheyReplied: null,
      tracyBody: `<html><body><p>${HANDOFF_OPENING} with Jason Kuperman.</p><p>You two should talk. Matthew has been commercializing a product, and you can compare notes on who is hiring GTM leaders.</p><p>deutsch74@gmail.com</p></body></html>`,
      resumeText: null,
    });
    assert.match(brief ?? "", /who is hiring GTM leaders/);
    assert.doesNotMatch(brief ?? "", /<p>/);
    assert.doesNotMatch(brief ?? "", /deutsch74/);
  });
});

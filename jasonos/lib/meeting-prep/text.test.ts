import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { purposeFromCalendarDescription, plainTextFromHtml } from "./text.ts";

describe("purposeFromCalendarDescription", () => {
  it("strips invite HTML and keeps the first 300 characters", () => {
    const html = `<p>Agree the pilot scope.</p><br><p>${"x".repeat(400)}</p>`;
    const purpose = purposeFromCalendarDescription(html);
    assert.ok(purpose);
    assert.equal(purpose!.startsWith("Agree the pilot scope."), true);
    assert.equal(purpose!.length, 300);
    assert.equal(purpose!.includes("<"), false);
  });

  it("returns null when the description is empty markup", () => {
    assert.equal(purposeFromCalendarDescription("<p>  </p>"), null);
    assert.equal(purposeFromCalendarDescription(null), null);
    assert.equal(plainTextFromHtml("<p>Hi&nbsp;there</p>"), "Hi there");
  });
});

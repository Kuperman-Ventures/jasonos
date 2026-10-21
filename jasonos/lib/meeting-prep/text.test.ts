import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isJoinBoilerplate, purposeFromCalendarDescription, plainTextFromHtml } from "./text.ts";

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

  it("returns null for Calendly Zoom web-conference dumps", () => {
    const html = `Event Name
30 Minute Meeting

Location: This is a Zoom web conference.

You can join this meeting from your computer, tablet, or smartphone.
https://us06web.zoom.us/j/88152580681?pwd=abc
Password: 778948
One tap mobile:
+1 646 931 3860,,88152580681#`;
    assert.equal(purposeFromCalendarDescription(html), null);
  });
});

describe("isJoinBoilerplate", () => {
  it("treats a Zoom invite as boilerplate and keeps a real purpose", () => {
    assert.equal(
      isJoinBoilerplate(
        "The Connective is inviting you to a scheduled Zoom meeting. Join Zoom Meeting https://us02web.zoom.us Meeting ID: 849 Passcode: 389 One tap mobile"
      ),
      true
    );
    assert.equal(
      isJoinBoilerplate(
        "Event Name 30 Minute Meeting Location: This is a Zoom web conference. You can join this meeting from your computer, tablet, or smartphone. https://us06web.zoom.us/j/88152580681?pwd=YnUTd8 Password: 778948 One tap mobile: +1 646 931 3860,,88152580681#"
      ),
      true
    );
    assert.equal(isJoinBoilerplate("Agree the pilot scope and who owns the follow-up."), false);
    assert.equal(isJoinBoilerplate(null), false);
  });
});

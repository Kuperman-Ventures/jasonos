import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { followUpDraft } from "./draft";
import { isAlreadyTracked, shouldQueueFollowUp } from "./follow-up";

describe("follow-up queue", () => {
  it("queues someone already written who never landed on the calendar", () => {
    assert.equal(
      shouldQueueFollowUp({ alreadyTracked: false, hasMeeting: false, hasOutreach: true }),
      true
    );
    assert.equal(
      shouldQueueFollowUp({ alreadyTracked: false, hasMeeting: true, hasOutreach: true }),
      false
    );
    assert.equal(
      shouldQueueFollowUp({ alreadyTracked: true, hasMeeting: false, hasOutreach: true }),
      false
    );
    assert.equal(
      shouldQueueFollowUp({ alreadyTracked: false, hasMeeting: false, hasOutreach: false }),
      false
    );
  });

  it("treats Matt and Matthew as the same person already on the page", () => {
    assert.equal(
      isAlreadyTracked(
        [{ email: "deutsch74@gmail.com", name: "Matthew Deutsch" }],
        { email: "deutsch74@gmail.com", name: "Matt Deutsch" }
      ),
      true
    );
    assert.equal(
      isAlreadyTracked(
        [{ email: null, name: "Timothy Serewicz" }],
        { email: "tim@serewicz.com", name: "Tim Serewicz" }
      ),
      true
    );
    assert.equal(
      isAlreadyTracked(
        [{ email: "deutsch74@gmail.com", name: "Matthew Deutsch" }],
        { email: "brad@example.com", name: "Brad Cole" }
      ),
      false
    );
  });

  it("writes a short follow-up to the last note", () => {
    const body = followUpDraft("Matthew Deutsch");
    assert.match(body, /^Following up, Matthew\./);
    assert.match(body, /times I sent still work/);
    assert.match(body, /next few weeks/);
    assert.match(body, /Jason$/);
    assert.doesNotMatch(body, /!/);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldSkipCalendarMeeting } from "./meeting-capture-filter.ts";

describe("shouldSkipCalendarMeeting", () => {
  it("skips tentative Hold · events", () => {
    assert.equal(
      shouldSkipCalendarMeeting({ title: "Hold · Tobias Töpel", guestEmails: ["tobias@x.com"] }),
      true
    );
  });

  it("keeps a real meeting", () => {
    assert.equal(
      shouldSkipCalendarMeeting({
        title: "Jason / Tobias Connect",
        guestEmails: ["tobias@x.com"],
      }),
      false
    );
  });

  it("skips when every guest is Jason", () => {
    assert.equal(
      shouldSkipCalendarMeeting({
        title: "Focus time",
        guestEmails: ["jskuperman@gmail.com"],
      }),
      true
    );
  });
});

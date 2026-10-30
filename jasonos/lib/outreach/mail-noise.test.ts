import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isEventPlatformAddress,
  isNoiseEmail,
} from "./mail-noise.ts";

describe("isEventPlatformAddress", () => {
  it("flags webinar and event platform organizers", () => {
    assert.equal(isEventPlatformAddress("calendar-invite@lu.ma"), true);
    assert.equal(isEventPlatformAddress("no-reply@zoom.us"), true);
    assert.equal(isEventPlatformAddress("no-reply@sequel.io"), true);
    assert.equal(isEventPlatformAddress("no-reply@livestorm-events.com"), true);
  });

  it("leaves real people alone", () => {
    assert.equal(isEventPlatformAddress("ved@leaddelta.com"), false);
    assert.equal(isEventPlatformAddress("mike@perlowproductions.com"), false);
  });
});

describe("isNoiseEmail includes event platforms", () => {
  it("treats calendar-invite@lu.ma as noise", () => {
    assert.equal(isNoiseEmail("calendar-invite@lu.ma"), true);
    assert.equal(isNoiseEmail("ved@leaddelta.com"), false);
  });
});

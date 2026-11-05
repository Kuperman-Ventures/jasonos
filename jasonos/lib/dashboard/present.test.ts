import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { presentNews, timelineTag, todayFlagPosition } from "./present.ts";

const dates = ["2026-11-18", "2026-12-15", "2027-01-03", "2027-02-15"];

describe("today flag", () => {
  it("sits at the start when today is before the first date", () => {
    const flag = todayFlagPosition(dates, new Date("2026-11-05T17:00:00Z"));
    assert.ok(flag);
    assert.equal(flag.left, "0%");
    assert.equal(flag.label, "Nov 5, 2026");
    assert.equal(flag.nextIndex, 0);
    assert.deepEqual(
      dates.map((_, index) => timelineTag(index, flag.nextIndex)),
      ["Next", null, null, null]
    );
  });

  it("moves between milestones and marks earlier ones done", () => {
    const flag = todayFlagPosition(dates, new Date("2026-12-20T17:00:00Z"));
    assert.ok(flag);
    assert.equal(flag.nextIndex, 2);
    assert.equal(flag.left, "32.25%");
    assert.deepEqual(
      dates.map((_, index) => timelineTag(index, flag.nextIndex)),
      ["Done", "Done", "Next", null]
    );
  });

  it("skips the flag when a date is missing", () => {
    assert.equal(todayFlagPosition(["2026-11-18", ""]), null);
  });
});

describe("news freshness", () => {
  const story = {
    added: "2026-11-05",
    url: "https://www.abcnews.com/Politics/story",
  };

  it("calls a story added on the New York date today", () => {
    const card = presentNews(story, new Date("2026-11-05T17:00:00Z"));
    assert.equal(card.age, "Added today");
    assert.equal(card.dateLabel, "Nov 5, 2026");
    assert.equal(card.domain, "abcnews.com");
    assert.equal(card.tone, "fresh");
    assert.equal(presentNews(story, new Date("2026-11-06T15:00:00Z")).age, "Added yesterday");
    assert.equal(presentNews(story, new Date("2026-11-08T15:00:00Z")).age, "Added 3 days ago");
  });
});

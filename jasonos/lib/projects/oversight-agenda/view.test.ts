import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NewsItem, TimelineItem } from "./data.ts";
import { countNote, decorateNews, decorateTimeline } from "./view.ts";

const timeline: TimelineItem[] = [
  { date: "2026-11-18", when: "Nov 18-19, 2026", what: "elections", why: "why" },
  { date: "2026-12-15", when: "Dec 2026", what: "chairs", why: "why" },
  { date: "2027-01-03", when: "Jan 3, 2027", what: "convenes", why: "why" },
  { date: "2027-02-15", when: "Q1 2027", what: "hearings", why: "why" },
];

const story: NewsItem = {
  added: "2026-11-05",
  outlet: "ABC News",
  headline: "Democrats take the House",
  url: "https://abcnews.com/Politics/story",
};

describe("oversight agenda views", () => {
  it("marks the first milestone next when today is still before it", () => {
    const view = decorateTimeline(timeline, new Date(2026, 10, 5, 12));
    assert.equal(view.todayLeft, "0%");
    assert.equal(view.todayLabel, "Nov 5, 2026");
    assert.deepEqual(
      view.items.map((item) => item.tag),
      ["Next", null, null, null]
    );
    assert.equal(view.items[0].opacity, 1);
  });

  it("dims milestones that have passed", () => {
    const view = decorateTimeline(timeline, new Date(2026, 11, 20, 12));
    assert.deepEqual(
      view.items.map((item) => item.tag),
      ["Done", "Done", "Next", null]
    );
    assert.equal(view.items[0].opacity, 0.55);
    assert.equal(view.items[2].opacity, 1);
  });

  it("ages a story from the date it was added", () => {
    const today = decorateNews([story], new Date(2026, 10, 5, 15))[0];
    assert.equal(today.age, "Added today");
    assert.equal(today.domain, "abcnews.com");
    assert.equal(today.dateLabel, "Nov 5, 2026");
    assert.equal(decorateNews([story], new Date(2026, 10, 6, 8))[0].age, "Added yesterday");
    assert.equal(decorateNews([story], new Date(2026, 10, 8, 8))[0].age, "Added 3 days ago");
    assert.equal(
      decorateNews(
        [{ ...story, url: "https://www.cbsnews.com/live" }],
        new Date(2026, 10, 5, 8)
      )[0].domain,
      "cbsnews.com"
    );
  });

  it("names the visible set", () => {
    assert.equal(countNote("all"), "All six areas");
    assert.equal(countNote("high"), "Filtered: high likelihood");
    assert.equal(countNote("low"), "Filtered: low likelihood");
  });
});

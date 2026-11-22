import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWebinarWeekEmail,
  previousWeekStart,
  weekOfLabel,
  type WeekEmailModel,
} from "./week-email.ts";

const sample: WeekEmailModel = {
  weekStart: "2026-11-16",
  actions: [
    {
      text: "Rewrite the search FAQ around buyer questions.",
      lead: "Rewrite the FAQ",
      session_title: "AI Search Ops",
      track: "advisors",
    },
    {
      text: "Send the attribution one-pager to the client.",
      lead: "",
      session_title: "Measurement Clinic",
      track: "advisors",
    },
  ],
  topics: [
    {
      slug: "ai-search-aeo",
      name: "AI Search and AEO/GEO",
      tint: "#e9f8ff",
      ink: "#006786",
      sessions: [
        {
          title: "AI Search Ops",
          host_org: "Fireflies",
          session_date: "2026-11-18",
          duration_minutes: 48,
          speakers: [{ name: "Ada Lovelace", org: "Fireflies" }],
          summary_md: "Search answers now beat the homepage. Keep the rest off the email.",
          takeaways: [
            {
              text: "Rewrite the search FAQ around buyer questions.",
              lead: "Rewrite the FAQ",
              is_action: true,
              track: "advisors",
            },
            {
              text: "Track citations weekly.",
              lead: "Track citations",
              is_action: false,
              track: null,
            },
            {
              text: "Drop vanity keyword lists.",
              lead: "",
              is_action: false,
              track: null,
            },
            {
              text: "Hidden fourth takeaway stays off the email.",
              lead: "",
              is_action: false,
              track: null,
            },
          ],
        },
      ],
    },
  ],
};

describe("week email helpers", () => {
  it("labels the week from the Monday date", () => {
    assert.equal(weekOfLabel("2026-11-16"), "Week of Nov 16");
  });

  it("steps back one week from this Monday", () => {
    assert.equal(previousWeekStart("2026-11-23"), "2026-11-16");
  });
});

describe("buildWebinarWeekEmail", () => {
  it("builds a scannable HTML and plain summary for last week", () => {
    const built = buildWebinarWeekEmail(sample);
    assert.equal(built.subject, "Webinars · Week of Nov 16");
    assert.equal(built.sessionCount, 1);
    assert.equal(built.takeawayCount, 4);
    assert.equal(built.actionCount, 2);
    assert.equal(built.topicCount, 1);

    assert.match(built.html, /bgcolor|#f6f5f3|background:#f6f5f3/);
    assert.match(built.html, /Actions from last week/);
    assert.match(built.html, /Rewrite the FAQ/);
    assert.match(built.html, /AI Search Ops/);
    assert.match(built.html, /Search answers now beat the homepage\./);
    assert.doesNotMatch(built.html, /Keep the rest off the email/);
    assert.doesNotMatch(built.html, /Hidden fourth takeaway/);
    assert.match(built.html, /Open webinars in JasonOS/);
    assert.match(built.html, /#006786/);

    assert.match(built.text, /Actions/);
    assert.match(built.text, /Rewrite the FAQ Rewrite the search FAQ/);
    assert.match(built.text, /https:\/\/jasonos\.vercel\.app\/webinars/);
  });

  it("escapes HTML in titles and takeaways", () => {
    const built = buildWebinarWeekEmail({
      weekStart: "2026-11-16",
      actions: [],
      topics: [
        {
          slug: "media-ooh",
          name: "Media <OOH>",
          tint: "#eae7e7",
          ink: "#444141",
          sessions: [
            {
              title: "Billboards & <scripts>",
              host_org: "Acme",
              session_date: "2026-11-17",
              duration_minutes: 30,
              speakers: [],
              summary_md: "A <b>bold</b> claim.",
              takeaways: [{ text: "Use <tag> carefully.", lead: "", is_action: false, track: null }],
            },
          ],
        },
      ],
    });
    assert.match(built.html, /Media &lt;OOH&gt;/);
    assert.match(built.html, /Billboards &amp; &lt;scripts&gt;/);
    assert.match(built.html, /Use &lt;tag&gt; carefully\./);
    assert.doesNotMatch(built.html, /<scripts>/);
  });
});

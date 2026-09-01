import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMorningBrief, parseNewsletterStory, newsletterStoryUrl } from "./parse-morning-brief.ts";

const EID =
  "https://www.google.com/calendar/event?eid=abc123 calendar@example.com&ctz=America/New_York";

function calendarMd(body: string): string {
  return `# Morning Brief\n\n## Calendar Today\n\n${body}\n`;
}

describe("parseMorningBrief calendar", () => {
  it("splits today's time+title-in-bold format and does not park the URL in the time column", () => {
    const parsed = parseMorningBrief(
      calendarMd(
        `- **10:00–11:00 AM — [Jason K](${EID})** — with jerry@example.com. **Job search.** No agenda in the invite.\n` +
          `- **3:00–3:45 PM — [Richard/Jason Catch Up](${EID})** — Richard Sunderland (Heavenly Group). [Zoom](https://zoom.us/j/123). Network/BD catch-up.\n` +
          `\nHousekeeping: AlphaSights and EQTY Lab each appear **twice** on the calendar. Delete the dupes or the reminders will double-fire.`
      )
    );

    assert.equal(parsed.calendar.length, 2);

    const first = parsed.calendar[0]!;
    assert.equal(first.time, "10:00–11:00 AM");
    assert.equal(first.time.includes("Jason"), false);
    assert.equal(first.time.includes("http"), false);
    assert.ok(first.title?.includes("Jason K"));
    assert.ok(first.title?.includes("%20"));
    assert.equal(/\seid=/.test(first.title ?? ""), false);
    assert.match(first.text, /jerry@example.com/);
    assert.equal(/eid=/.test(first.text), false);

    const second = parsed.calendar[1]!;
    assert.equal(second.time, "3:00–3:45 PM");
    assert.ok(second.title?.includes("Richard/Jason Catch Up"));
    assert.match(second.text, /Heavenly Group/);
    assert.match(second.text, /\[Zoom\]/);

    assert.match(parsed.calendarNote ?? "", /Delete the dupes/);
  });

  it("keeps the classic **time** — [title](url) — notes shape", () => {
    const parsed = parseMorningBrief(
      calendarMd(
        `- **2:00–4:00 PM** — [Follow-up Notes](${EID}) (CoSA Calendar). Solo block, no attendees.`
      )
    );
    const ev = parsed.calendar[0]!;
    assert.equal(ev.time, "2:00–4:00 PM");
    assert.ok(ev.title?.includes("Follow-up Notes"));
    assert.match(ev.text, /CoSA Calendar/);
    assert.equal(ev.time.includes("http"), false);
  });

  it("parses unbolded time — title bullets", () => {
    const parsed = parseMorningBrief(
      calendarMd(
        `- 8:00–10:00 AM — [(4) Workout](${EID}) — personal, moved from Sunday`
      )
    );
    const ev = parsed.calendar[0]!;
    assert.equal(ev.time, "8:00–10:00 AM");
    assert.ok(ev.title?.includes("(4) Workout"));
    assert.match(ev.text, /personal/);
  });

  it("parses times without AM/PM", () => {
    const parsed = parseMorningBrief(
      calendarMd(`- **9:30–10:00** — [Plan for Week](${EID}) (solo)`)
    );
    assert.equal(parsed.calendar[0]?.time, "9:30–10:00");
    assert.ok(parsed.calendar[0]?.title?.includes("Plan for Week"));
  });

  it("parses 10:00 AM–12:00 PM ranges", () => {
    const parsed = parseMorningBrief(
      calendarMd(`- **10:00 AM–12:00 PM** — [Follow-up Notes](${EID})`)
    );
    assert.equal(parsed.calendar[0]?.time, "10:00 AM–12:00 PM");
  });
});

describe("parseMorningBrief newsletter", () => {
  it("joins continuation lines into one story summary", () => {
    const parsed = parseMorningBrief(`# Morning Brief

## Newsletter Digest

### AI in general

- [Ford rehired grey beards](https://example.com/ford) — Ford cut roles, then rehired veterans.
  IKEA retrained 8,500 staff instead of cutting. One line to steal: nothing kills adoption faster than an outsider who is too good at their job.
`);
    const story = parsed.newsletters[1]?.stories[0];
    assert.ok(story);
    assert.match(story!.summary, /IKEA retrained/);
    assert.ok(story!.summary.length > story!.teaser.length + 20);
  });

  it("newsletterStoryUrl falls back to a link inside the summary", () => {
    const story = parseNewsletterStory(
      "[Hugging Face sale](https://example.com/hf) — last valued at $4.5B. Also see [IPO dud](https://example.com/ipo)."
    );
    assert.ok(story);
    assert.equal(story!.url, "https://example.com/hf");
    assert.equal(newsletterStoryUrl(story!), "https://example.com/hf");
  });

  it("does not treat a Gmail permalink as an article link", () => {
    const story = parseNewsletterStory(
      "[The Hugging Face attack was worse than we thought](https://mail.google.com/mail/u/0/#all/1a05a6d4906b5048) — A 91-page METR/Redwood report."
    );
    assert.ok(story);
    assert.equal(story!.title, "The Hugging Face attack was worse than we thought");
    assert.equal(story!.url, null);
    assert.equal(newsletterStoryUrl(story!), null);
    assert.match(story!.summary, /91-page/);
  });

  it("does not treat a Marketing Brew issue page as the article", () => {
    const story = parseNewsletterStory(
      "[Mentions vs. citations in AI answers](https://www.marketingbrew.com/issues/come-get-your-honey) — Directly relevant to this morning's Heavenly AEO/GEO call."
    );
    assert.ok(story);
    assert.equal(story!.title, "Mentions vs. citations in AI answers");
    assert.equal(story!.url, null);
    assert.equal(newsletterStoryUrl(story!), null);
  });

  it("drops an article URL reused on two different headlines", () => {
    const parsed = parseMorningBrief(`# Morning Brief

## Newsletter Digest

### Marketing and Media News

- [Nielsen takes DoubleVerify private](https://www.linkedin.com/pulse/nielsen-ai-slop-rebirth-marketing-rigour-trinityp3-nr8ac) — Measurement collapse.
- [Allianz banked AI savings](https://www.linkedin.com/pulse/nielsen-ai-slop-rebirth-marketing-rigour-trinityp3-nr8ac) — Reallocated to brand.

### AI and Business

- [FTC sues Amazon](https://www.axios.com/2026/08/31/ftc-amazon) — Overcharges.
`);
    const stories = parsed.newsletters.flatMap((g) => g.stories);
    const nielsen = stories.find((s) => s.title.includes("Nielsen"));
    const allianz = stories.find((s) => s.title.includes("Allianz"));
    const ftc = stories.find((s) => s.title.includes("FTC"));
    assert.equal(nielsen?.url, null);
    assert.equal(allianz?.url, null);
    assert.equal(ftc?.url, "https://www.axios.com/2026/08/31/ftc-amazon");
  });

  it("unlinks a mismatched issue URL in Needs your attention", () => {
    const parsed = parseMorningBrief(`# Morning Brief

## Needs Your Attention

1. The [mentions-vs-citations piece](https://www.marketingbrew.com/issues/come-get-your-honey) and the [AI Overviews expansion](https://9to5google.com/2026/08/31/google-search-ai-overviews-bigger/) are live ammunition.
`);
    const item = parsed.attention[0] ?? "";
    assert.match(item, /mentions-vs-citations piece/);
    assert.equal(item.includes("come-get-your-honey"), false);
    assert.match(item, /9to5google.com/);
  });
});

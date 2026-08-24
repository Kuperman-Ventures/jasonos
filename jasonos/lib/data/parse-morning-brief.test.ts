import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMorningBrief } from "./parse-morning-brief.ts";

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

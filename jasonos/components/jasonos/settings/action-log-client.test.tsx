import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ActionLogClient } from "./action-log-client";
import type { ActionLogRow } from "@/lib/actions/action-log-format";
import type { UpcomingItem } from "@/lib/actions/upcoming-format";

const TODAY = "2026-11-02";

const upcoming: UpcomingItem[] = [
  {
    id: "email:old",
    dueOn: "2026-10-28",
    area: "Email follow-up",
    subject: "Check in with Dana",
    detail: "To dana@example.com",
    href: "/outreach/sent",
  },
  {
    id: "touch:later",
    dueOn: "2026-11-04",
    area: "Next touch",
    subject: "Priya Shah",
    detail: null,
    href: null,
  },
];

const rows: ActionLogRow[] = [
  {
    id: "log-1",
    acted_at: "2026-11-02T16:05:00.000Z",
    verb: "Snoozed",
    area: "Email follow-up",
    subject: "Follow up on the intro",
    detail: "3 days · due Tue, Nov 4",
    actor: "jason",
  },
];

function render(): string {
  return renderToStaticMarkup(
    <ActionLogClient rows={rows} upcoming={upcoming} today={TODAY} capped={false} />
  );
}

describe("Action log day groups", () => {
  it("starts each day group collapsed, with the count still on the header", () => {
    const html = render();
    assert.equal(html.includes('aria-expanded="true"'), false);
    assert.equal((html.match(/aria-expanded="false"/g) ?? []).length, 3);
    assert.match(html, /Overdue · 1/);
    assert.match(html, /Wednesday, Nov 4 · 1/);
    assert.match(html, /Monday, Nov 2 · 1/);
    assert.equal(html.includes("Check in with Dana"), false);
    assert.equal(html.includes("Priya Shah"), false);
    assert.equal(html.includes("Follow up on the intro"), false);
    assert.equal(html.includes("<h3"), false);
  });
});

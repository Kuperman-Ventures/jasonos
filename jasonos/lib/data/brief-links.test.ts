import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  friendlyLinkLabel,
  hrefFromMarkdownUrl,
  rewriteMarkdownHrefs,
  tokenizeBriefText,
} from "./brief-links.ts";

const CAL =
  "https://www.google.com/calendar/event?eid=abc123 calendar@example.com&ctz=America/New_York";

describe("hrefFromMarkdownUrl", () => {
  it("encodes the space in a Google Calendar eid", () => {
    assert.match(CAL, / /);
    assert.equal(hrefFromMarkdownUrl(CAL), CAL.replace(" ", "%20"));
  });
});

describe("rewriteMarkdownHrefs", () => {
  it("rewrites spaces inside markdown calendar links", () => {
    const out = rewriteMarkdownHrefs(`[Jason K](${CAL})`);
    assert.equal(out, `[Jason K](${CAL.replace(" ", "%20")})`);
  });
});

describe("tokenizeBriefText", () => {
  it("keeps the event title as the label, not the raw eid URL", () => {
    const pieces = tokenizeBriefText(
      `10:00–11:00 AM — [Jason K](${CAL}) — with jerry@example.com`
    );
    const link = pieces.find((p) => p.type === "link");
    assert.ok(link && link.type === "link");
    assert.equal(link.label, "Jason K");
    assert.equal(link.href.includes("%20"), true);
    assert.equal(
      pieces.some((p) => p.type === "text" && /eid=/.test(p.value)),
      false
    );
  });

  it("labels a bare calendar URL instead of printing the eid", () => {
    const noSpace = CAL.replace(" ", "%20");
    const pieces = tokenizeBriefText(noSpace);
    assert.equal(pieces.length, 1);
    assert.equal(pieces[0]?.type, "link");
    if (pieces[0]?.type === "link") {
      assert.equal(pieces[0].label, "Open in Calendar");
    }
  });
});

describe("friendlyLinkLabel", () => {
  it("prefers a human label over the URL", () => {
    assert.equal(friendlyLinkLabel("https://example.com/x", "Follow-up Notes"), "Follow-up Notes");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyBriefUrl,
  dropReusedArticleUrls,
  isAllowedBriefHref,
  unlinkDisallowedHrefs,
  usableArticleUrl,
} from "./brief-outbound";

describe("classifyBriefUrl", () => {
  it("treats a news article as an article", () => {
    assert.equal(
      classifyBriefUrl("https://www.axios.com/2026/08/31/ftc-amazon-deceptive-advertising-lawsuit"),
      "article"
    );
    assert.equal(
      classifyBriefUrl("https://9to5google.com/2026/08/31/google-search-ai-overviews-bigger/"),
      "article"
    );
  });

  it("treats a Gmail thread permalink as email, not an article", () => {
    const gmail = "https://mail.google.com/mail/u/0/#all/1a05a6d4906b5048";
    assert.equal(classifyBriefUrl(gmail), "email");
    assert.equal(usableArticleUrl(gmail), null);
    assert.equal(isAllowedBriefHref(gmail, ["article"]), false);
    assert.equal(isAllowedBriefHref(gmail, ["email"]), true);
  });

  it("rejects a Gmail URL with no thread id", () => {
    assert.equal(classifyBriefUrl("https://mail.google.com/mail/u/0/#inbox"), null);
    assert.equal(usableArticleUrl("https://mail.google.com/mail/u/0/#inbox"), null);
  });

  it("rejects Morning Brew issue landings (whole edition, not the story)", () => {
    const issue = "https://www.marketingbrew.com/issues/come-get-your-honey";
    assert.equal(classifyBriefUrl(issue), null);
    assert.equal(usableArticleUrl(issue), null);
  });

  it("keeps a Marketing Brew story URL", () => {
    assert.equal(
      classifyBriefUrl(
        "https://www.marketingbrew.com/stories/why-nuuly-is-taking-a-chance-on-microdramas"
      ),
      "article"
    );
  });

  it("rejects Google search, redirect, and news URLs", () => {
    assert.equal(classifyBriefUrl("https://www.google.com/url?q=https://example.com/x"), null);
    assert.equal(classifyBriefUrl("https://www.google.com/search?q=hugging+face"), null);
    assert.equal(classifyBriefUrl("https://news.google.com/articles/abc"), null);
  });

  it("keeps Google Calendar and Zoom", () => {
    assert.equal(
      classifyBriefUrl(
        "https://www.google.com/calendar/event?eid=abc123 jason@example.com&ctz=America/New_York"
      ),
      "calendar"
    );
    assert.equal(classifyBriefUrl("https://us06web.zoom.us/j/84543034312"), "meeting");
  });
});

describe("unlinkDisallowedHrefs", () => {
  it("keeps the title text when the href is an issue landing", () => {
    const out = unlinkDisallowedHrefs(
      "See the [mentions-vs-citations piece](https://www.marketingbrew.com/issues/come-get-your-honey) today."
    );
    assert.equal(out.includes("mentions-vs-citations piece"), true);
    assert.equal(out.includes("http"), false);
  });
});

describe("dropReusedArticleUrls", () => {
  it("clears a URL that was pasted onto two different stories", () => {
    const shared = "https://www.linkedin.com/pulse/nielsen-ai-slop-rebirth-marketing-rigour-trinityp3-nr8ac";
    const out = dropReusedArticleUrls([
      { title: "Nielsen", url: shared },
      { title: "Allianz", url: shared },
      { title: "FTC", url: "https://www.axios.com/2026/08/31/ftc" },
    ]);
    assert.equal(out[0]?.url, null);
    assert.equal(out[1]?.url, null);
    assert.equal(out[2]?.url, "https://www.axios.com/2026/08/31/ftc");
  });
});

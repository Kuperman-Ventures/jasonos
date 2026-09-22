import assert from "node:assert/strict";
import { test } from "node:test";
import {
  absoluteUrl,
  parseLinkPreviewHtml,
  summarizeLinkPreview,
} from "./link-preview";

test("absoluteUrl resolves relative og:image paths", () => {
  assert.equal(
    absoluteUrl("https://www.washington.edu/admissions/", "/images/hero.jpg"),
    "https://www.washington.edu/images/hero.jpg",
  );
  assert.equal(absoluteUrl("https://example.com", "https://cdn.example.com/a.png"), "https://cdn.example.com/a.png");
  assert.equal(absoluteUrl("https://example.com", ""), null);
});

test("parseLinkPreviewHtml reads Open Graph tags", () => {
  const html = `<!doctype html><html><head>
    <meta property="og:title" content="UW Admissions &amp; Aid" />
    <meta property="og:description" content="Apply to the University of Washington." />
    <meta property="og:image" content="/static/og.jpg" />
    <meta property="og:site_name" content="University of Washington" />
    <title>Fallback Title</title>
  </head><body><p>Hello campus visitors and families.</p></body></html>`;

  const preview = parseLinkPreviewHtml(html, "https://www.washington.edu/admissions/");
  assert.equal(preview.title, "UW Admissions & Aid");
  assert.equal(preview.description, "Apply to the University of Washington.");
  assert.equal(preview.imageUrl, "https://www.washington.edu/static/og.jpg");
  assert.equal(preview.siteName, "University of Washington");
  assert.match(preview.text, /Hello campus visitors/);
  assert.equal(summarizeLinkPreview(preview), "Apply to the University of Washington.");
});

test("parseLinkPreviewHtml falls back to title and description meta", () => {
  const html = `<html><head>
    <title>Plain Page</title>
    <meta name="description" content="A short blurb about the page." />
  </head><body>Body copy here for summary fallback when description is missing.</body></html>`;

  const preview = parseLinkPreviewHtml(html, "https://example.com/x");
  assert.equal(preview.title, "Plain Page");
  assert.equal(preview.description, "A short blurb about the page.");
  assert.equal(preview.imageUrl, null);
});

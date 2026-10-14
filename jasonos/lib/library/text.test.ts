import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { libraryBodyHash } from "./hash.ts";
import {
  defaultLibraryTitle,
  extractSubjectOnPaste,
  formatCopyLine,
  libraryBodyHashSource,
  libraryCountLabel,
  libraryRowContext,
  librarySearchMatch,
  librarySnippet,
  storedLibraryBody,
} from "./text.ts";

describe("library text", () => {
  it("stores CRLF as LF and leaves inner spacing alone", () => {
    assert.equal(storedLibraryBody("a\r\n\r\nb  c\r\n"), "a\n\nb  c\n");
  });

  it("hashes the trimmed body and ignores outer whitespace only", () => {
    const source = libraryBodyHashSource("  Hello\n\nthere  ");
    assert.equal(source, "Hello\n\nthere");
    assert.equal(
      libraryBodyHash("\r\nHello\n\nthere\r\n"),
      createHash("sha256").update("Hello\n\nthere", "utf8").digest("hex")
    );
  });

  it("builds a title from the first non-empty line", () => {
    assert.equal(defaultLibraryTitle("\n\n  Subject: Hello there\n\nBody"), "Hello there");
    assert.equal(defaultLibraryTitle("x".repeat(100)), "x".repeat(80));
    assert.equal(defaultLibraryTitle("   \n"), "Untitled");
  });

  it("lifts a pasted subject line and one blank line under it", () => {
    const extracted = extractSubjectOnPaste("Subject: Intro note\n\nHi Andrew,\n\nThanks.");
    assert.deepEqual(extracted, {
      subject: "Intro note",
      body: "Hi Andrew,\n\nThanks.",
    });
    assert.equal(extractSubjectOnPaste("  Subject: no"), null);
    assert.equal(extractSubjectOnPaste("Hello\nSubject: later"), null);
  });

  it("centers the snippet on the first body match", () => {
    const body = `${"a".repeat(80)} NEEDLE ${"b".repeat(80)}`;
    const snippet = librarySnippet(body, "needle");
    assert.match(snippet, /^… /);
    assert.match(snippet, / …$/);
    const at = snippet.toLowerCase().indexOf("needle");
    assert.ok(at > 20 && at < snippet.length - 20);
  });

  it("matches search across title, body, subject, contacts, and company", () => {
    const item = {
      title: "Intro",
      body: "Hello there",
      subject: "Catching up",
      company: "Acme",
      contacts: [{ name: "Andrew Weiss", company: "Northwind" }],
    };
    assert.equal(librarySearchMatch(item, "andrew"), true);
    assert.equal(librarySearchMatch(item, "northwind"), true);
    assert.equal(librarySearchMatch(item, "acme"), true);
    assert.equal(librarySearchMatch(item, "catching"), true);
    assert.equal(librarySearchMatch(item, "missing"), false);
  });

  it("formats the copy line and the rail count", () => {
    assert.equal(formatCopyLine(0, null), "Not copied yet");
    assert.equal(
      formatCopyLine(1, "2026-10-12T15:00:00.000Z", new Date("2026-10-14T12:00:00Z")),
      "Copied 1 time, last on Oct 12"
    );
    assert.equal(libraryCountLabel(48, 48, false), "48 messages");
    assert.equal(libraryCountLabel(1, 1, false), "1 message");
    assert.equal(libraryCountLabel(48, 3, true), "3 of 48 shown");
  });

  it("summarizes several contacts as name + count", () => {
    assert.equal(
      libraryRowContext({
        channel: "email",
        company: "Acme",
        contacts: [{ name: "Andrew Weiss" }, { name: "Priya Shah" }],
      }),
      "Email · Andrew Weiss +1 · Acme"
    );
  });
});

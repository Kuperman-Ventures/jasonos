import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHtmlRawMessage,
  buildPlainTextRawMessage,
  encodeMimeHeader,
} from "./gmail-mime.ts";

describe("encodeMimeHeader", () => {
  it("leaves ASCII subjects alone", () => {
    assert.equal(
      encodeMimeHeader("Reminder - call with Jason Kuperman"),
      "Reminder - call with Jason Kuperman"
    );
  });

  it("RFC 2047-encodes em dashes so clients do not show mojibake", () => {
    const encoded = encodeMimeHeader("Reminder — call with Jason");
    assert.match(encoded, /^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
    const b64 = encoded.slice("=?UTF-8?B?".length, -"?=".length);
    assert.equal(Buffer.from(b64, "base64").toString("utf8"), "Reminder — call with Jason");
  });
});

describe("buildPlainTextRawMessage", () => {
  it("puts an encoded Subject and base64 body in the raw MIME", () => {
    const raw = buildPlainTextRawMessage({
      to: "alex@example.com",
      subject: "Reminder — call",
      body: "Hi Alex,\n\nLooking forward to it,\nJason",
    });
    assert.match(raw, /^Subject: =\?UTF-8\?B\?/m);
    assert.match(raw, /Content-Transfer-Encoding: base64/);
    assert.doesNotMatch(raw, /^Subject: Reminder —/m);
  });
});

describe("buildHtmlRawMessage", () => {
  it("wraps plain and HTML parts in multipart/alternative", () => {
    const raw = buildHtmlRawMessage({
      to: "jason@kupermanadvisors.com",
      subject: "Webinars · Week of Nov 16",
      body: "Plain summary",
      htmlBody: "<p><strong>HTML</strong> summary</p>",
    });
    assert.match(raw, /Content-Type: multipart\/alternative; boundary="/);
    assert.match(raw, /Content-Type: text\/plain; charset=utf-8/);
    assert.match(raw, /Content-Type: text\/html; charset=utf-8/);
    const plainB64 = raw
      .split("Content-Type: text/plain; charset=utf-8")[1]
      ?.split("Content-Transfer-Encoding: base64")[1]
      ?.split("--")[0]
      ?.replace(/\s+/g, "");
    const htmlB64 = raw
      .split("Content-Type: text/html; charset=utf-8")[1]
      ?.split("Content-Transfer-Encoding: base64")[1]
      ?.split("--")[0]
      ?.replace(/\s+/g, "");
    assert.equal(Buffer.from(plainB64 ?? "", "base64").toString("utf8"), "Plain summary");
    assert.equal(
      Buffer.from(htmlB64 ?? "", "base64").toString("utf8"),
      "<p><strong>HTML</strong> summary</p>"
    );
  });
});

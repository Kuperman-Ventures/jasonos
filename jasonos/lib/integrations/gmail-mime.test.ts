import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPlainTextRawMessage, encodeMimeHeader } from "./gmail-mime.ts";

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

import assert from "node:assert/strict";
import test from "node:test";
import { extractRtfText, isRtfFile, looksLikeRtf, looksLikeRtfBytes, rtfToPlainText } from "./rtf";

const sample = String.raw`{\rtf1\ansi\ansicpg1252{\fonttbl{\f0 Times;}}\f0\fs24 Register Kyle for the October PSAT\par Complete the counselor packet}`;

test("isRtfFile accepts rtf and rtfd names and mime types", () => {
  assert.equal(isRtfFile({ name: "Notes.rtfd" }), true);
  assert.equal(isRtfFile({ name: "Notes.rtf" }), true);
  assert.equal(isRtfFile({ name: "TXT.rtf" }), true);
  assert.equal(isRtfFile({ name: "letter.rtf", type: "application/rtf" }), true);
  assert.equal(isRtfFile({ name: "scan.png", type: "image/png" }), false);
});

test("rtfToPlainText strips control words and keeps body text", () => {
  assert.equal(looksLikeRtf(sample), true);
  const text = rtfToPlainText(sample);
  assert.match(text, /Register Kyle for the October PSAT/);
  assert.match(text, /Complete the counselor packet/);
  assert.doesNotMatch(text, /\\par/);
  assert.doesNotMatch(text, /\\rtf1/);
});

test("rtfToPlainText decodes hex and unicode escapes", () => {
  assert.equal(rtfToPlainText(String.raw`{\rtf1 caf\'e9}`), "café");
  assert.equal(rtfToPlainText(String.raw`{\rtf1 \u8212- dash}`).includes("dash"), true);
});

test("extractRtfText reads latin1 bytes", async () => {
  const bytes = new TextEncoder().encode(sample);
  const text = await extractRtfText(bytes);
  assert.match(text, /PSAT/);
});

test("looksLikeRtfBytes sniffs the RTF header", () => {
  const rtf = new TextEncoder().encode(sample);
  const pdf = new TextEncoder().encode("%PDF-1.4");
  assert.equal(looksLikeRtfBytes(rtf), true);
  assert.equal(looksLikeRtfBytes(pdf), false);
  assert.equal(looksLikeRtfBytes(new Uint8Array()), false);
});

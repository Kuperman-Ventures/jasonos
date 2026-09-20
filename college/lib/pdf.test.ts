import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { extractPdfText, isPdfFile, MAX_PDF_BYTES } from "./pdf";

const fixture = join(dirname(fileURLToPath(import.meta.url)), "fixtures/webinar-sample.pdf");

test("isPdfFile accepts pdf names and mime types", () => {
  assert.equal(isPdfFile({ name: "deck.pdf", type: "" }), true);
  assert.equal(isPdfFile({ name: "notes.txt", type: "application/pdf" }), true);
  assert.equal(isPdfFile({ name: "notes.txt", type: "text/plain" }), false);
});

test("extractPdfText pulls webinar slide text", async () => {
  const bytes = new Uint8Array(readFileSync(fixture));
  const { text, pageCount } = await extractPdfText(bytes);
  assert.equal(pageCount, 1);
  assert.match(text, /SAT reading/i);
  assert.match(text, /campus visit/i);
  assert.match(text, /counselor/i);
});

test("extractPdfText rejects empty and oversized buffers", async () => {
  await assert.rejects(() => extractPdfText(new Uint8Array()), /empty/i);
  const big = new Uint8Array(MAX_PDF_BYTES + 1);
  await assert.rejects(() => extractPdfText(big), /too large/i);
});

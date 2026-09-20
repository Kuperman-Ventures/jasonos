import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { readPdfForIngest } from "./pdf-ocr";

const fixture = join(dirname(fileURLToPath(import.meta.url)), "fixtures/webinar-sample.pdf");

test("readPdfForIngest uses embedded text when present", async () => {
  const bytes = new Uint8Array(readFileSync(fixture));
  const phases: string[] = [];
  const result = await readPdfForIngest(bytes, (progress) => phases.push(progress.phase));
  assert.equal(result.method, "embedded");
  assert.match(result.text, /SAT reading/i);
  assert.ok(phases.includes("reading"));
  assert.ok(phases.includes("done"));
  // Caller buffer must stay usable after PDF.js load (no accidental detach of the original).
  assert.equal(bytes.byteLength > 0, true);
  assert.doesNotThrow(() => bytes.slice(0, 4));
});

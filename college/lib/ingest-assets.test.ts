import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptIngestAttr,
  formatBytes,
  ingestAssetKind,
  ingestExtension,
  ingestFileKind,
  isIngestFile,
} from "./ingest-assets";

test("isIngestFile accepts decks, pdf, and email", () => {
  assert.equal(isIngestFile({ name: "deck.pdf", type: "application/pdf" }), true);
  assert.equal(isIngestFile({ name: "Junior Night.pptx", type: "" }), true);
  assert.equal(isIngestFile({ name: "Counselor.eml", type: "message/rfc822" }), true);
  assert.equal(isIngestFile({ name: "scan.png", type: "image/png" }), false);
  assert.equal(isIngestFile({ name: "notes.txt", type: "text/plain" }), false);
});

test("ingestFileKind and extension", () => {
  assert.equal(ingestFileKind({ name: "a.pdf" }), "pdf");
  assert.equal(ingestFileKind({ name: "a.pptx" }), "deck");
  assert.equal(ingestFileKind({ name: "a.eml" }), "email");
  assert.equal(ingestAssetKind("application/pdf"), "pdf");
  assert.equal(ingestExtension("application/pdf", "x.pdf"), "pdf");
  assert.equal(ingestExtension("", "talk.pptx"), "pptx");
});

test("accept attr lists pptx pdf eml", () => {
  const accept = acceptIngestAttr();
  assert.match(accept, /pptx/i);
  assert.match(accept, /pdf/i);
  assert.match(accept, /eml/i);
  assert.doesNotMatch(accept, /png/i);
});

test("formatBytes", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), "2.0 KB");
  assert.equal(formatBytes(4.2 * 1048576), "4.2 MB");
});

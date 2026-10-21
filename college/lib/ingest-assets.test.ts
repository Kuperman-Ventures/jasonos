import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptIngestAttr,
  formatBytes,
  ingestAssetKind,
  ingestExtension,
  ingestFileKind,
  INGEST_FILE_HINT,
  isIngestFile,
} from "./ingest-assets";

test("isIngestFile accepts decks, pdf, email, rich text, and images", () => {
  assert.equal(isIngestFile({ name: "deck.pdf", type: "application/pdf" }), true);
  assert.equal(isIngestFile({ name: "Junior Night.pptx", type: "" }), true);
  assert.equal(isIngestFile({ name: "Counselor.eml", type: "message/rfc822" }), true);
  assert.equal(isIngestFile({ name: "Notes.rtfd", type: "" }), true);
  assert.equal(isIngestFile({ name: "Notes.rtf", type: "application/rtf" }), true);
  assert.equal(isIngestFile({ name: "TXT.rtf", type: "" }), true);
  assert.equal(isIngestFile({ name: "scan.png", type: "image/png" }), true);
  assert.equal(isIngestFile({ name: "photo.jpg", type: "image/jpeg" }), true);
  assert.equal(isIngestFile({ name: "notes.txt", type: "text/plain" }), false);
});

test("ingestFileKind and extension", () => {
  assert.equal(ingestFileKind({ name: "a.pdf" }), "pdf");
  assert.equal(ingestFileKind({ name: "a.pptx" }), "deck");
  assert.equal(ingestFileKind({ name: "a.eml" }), "email");
  assert.equal(ingestFileKind({ name: "a.rtfd" }), "rtf");
  assert.equal(ingestFileKind({ name: "a.rtf" }), "rtf");
  assert.equal(ingestFileKind({ name: "Notes.rtf", type: "application/pdf" }), "rtf");
  assert.equal(ingestFileKind({ name: "scan.png", type: "image/png" }), "image");
  assert.equal(ingestAssetKind("application/pdf"), "pdf");
  assert.equal(ingestAssetKind("application/rtf"), "rtf");
  assert.equal(ingestAssetKind("image/png"), "image");
  assert.equal(ingestExtension("application/pdf", "x.pdf"), "pdf");
  assert.equal(ingestExtension("", "talk.pptx"), "pptx");
  assert.equal(ingestExtension("", "Notes.rtfd"), "rtf");
  assert.equal(ingestExtension("application/rtf", "letter.rtf"), "rtf");
  assert.equal(ingestExtension("image/png", "scan.png"), "png");
});

test("accept attr lists pptx pdf eml rtf rtfd and images", () => {
  const accept = acceptIngestAttr();
  assert.match(accept, /pptx/i);
  assert.match(accept, /pdf/i);
  assert.match(accept, /eml/i);
  assert.match(accept, /\.rtf/i);
  assert.match(accept, /\.rtfd/i);
  assert.match(accept, /png/i);
  assert.match(accept, /image\/jpeg/i);
  assert.match(INGEST_FILE_HINT, /rtfd/i);
  assert.match(INGEST_FILE_HINT, /image/i);
});

test("formatBytes", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), "2.0 KB");
  assert.equal(formatBytes(4.2 * 1048576), "4.2 MB");
});

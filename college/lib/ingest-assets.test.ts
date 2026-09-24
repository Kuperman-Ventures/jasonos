import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptIngestAttr,
  ingestAssetKind,
  ingestExtension,
  isIngestFile,
} from "./ingest-assets";

test("isIngestFile accepts pdf and common images", () => {
  assert.equal(isIngestFile({ name: "deck.pdf", type: "application/pdf" }), true);
  assert.equal(isIngestFile({ name: "scan.png", type: "image/png" }), true);
  assert.equal(isIngestFile({ name: "photo.JPG", type: "image/jpeg" }), true);
  assert.equal(isIngestFile({ name: "notes.txt", type: "text/plain" }), false);
});

test("ingestAssetKind and extension", () => {
  assert.equal(ingestAssetKind("application/pdf"), "pdf");
  assert.equal(ingestAssetKind("image/png"), "image");
  assert.equal(ingestExtension("image/jpeg"), "jpg");
  assert.equal(ingestExtension("application/pdf", "x.pdf"), "pdf");
});

test("accept attr lists pdf and images", () => {
  const accept = acceptIngestAttr();
  assert.match(accept, /pdf/i);
  assert.match(accept, /png/i);
  assert.match(accept, /webp/i);
});

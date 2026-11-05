import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSchoolPhotoStoragePath,
  normalizeImageMime,
  schoolPhotoExtension,
} from "./school-family-photos";

test("normalizeImageMime accepts common camera types and name fallbacks", () => {
  assert.equal(normalizeImageMime({ type: "image/jpeg", name: "a.jpg" }), "image/jpeg");
  assert.equal(normalizeImageMime({ type: "", name: "visit.HEIC" }), "image/heic");
  assert.equal(normalizeImageMime({ type: "application/pdf", name: "x.pdf" }), null);
});

test("schoolPhotoExtension maps mime and filenames", () => {
  assert.equal(schoolPhotoExtension("image/jpeg", "pic.JPEG"), "jpg");
  assert.equal(schoolPhotoExtension("image/png"), "png");
  assert.equal(schoolPhotoExtension("image/heic", "cam.heic"), "heic");
});

test("buildSchoolPhotoStoragePath nests by school and member", () => {
  const path = buildSchoolPhotoStoragePath("upenn", "jason", "jpg");
  assert.match(path, /^upenn\/jason\/\d+-[a-z0-9]+\.jpg$/);
});

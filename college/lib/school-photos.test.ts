import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogSchoolNames,
  schoolPhotosForSchool,
  schoolPhotosHeadingName,
  virtualTourUrlForSchool,
} from "./school-photos";

test("catalog covers five schools with eight photos each", () => {
  const names = catalogSchoolNames();
  assert.equal(names.length, 5);
  for (const name of names) {
    const photos = schoolPhotosForSchool("id", name);
    assert.equal(photos.length, 8, name);
    assert.ok(virtualTourUrlForSchool(name));
    for (const photo of photos) {
      assert.equal(photo.kind, "school");
      assert.ok(photo.src);
      assert.ok(photo.thumbSrc);
      assert.ok(photo.credit);
      assert.ok(photo.license);
      assert.ok(photo.sourceUrl);
    }
  }
});

test("unknown schools have no photos and null virtual tour", () => {
  assert.deepEqual(schoolPhotosForSchool("x", "Unknown University"), []);
  assert.equal(virtualTourUrlForSchool("Unknown University"), null);
});

test("schoolPhotosHeadingName prefers paren nickname", () => {
  assert.equal(
    schoolPhotosHeadingName("Georgia Institute of Technology (Georgia Tech)"),
    "Georgia Tech",
  );
  assert.equal(schoolPhotosHeadingName("Purdue University"), "Purdue University");
});

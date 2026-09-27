import assert from "node:assert/strict";
import test from "node:test";
import schoolsFile from "@/content/schools.json";
import {
  catalogSchoolNames,
  schoolPhotosForSchool,
  schoolPhotosHeadingName,
  virtualTourUrlForSchool,
  visitAddressForSchool,
} from "./school-photos";

const LIST_NAMES = (schoolsFile as { schools: { id: string; name: string }[] }).schools.map(
  (row) => row.name,
);

test("catalog covers all 43 list schools with photos and tours", () => {
  const names = catalogSchoolNames();
  assert.equal(names.length, 43);
  assert.deepEqual([...names].sort(), [...LIST_NAMES].sort());

  let total = 0;
  for (const name of names) {
    const photos = schoolPhotosForSchool("id", name);
    assert.ok(photos.length >= 6, `${name} has ${photos.length} photos`);
    assert.ok(photos.length <= 8, `${name} has ${photos.length} photos`);
    total += photos.length;
    assert.ok(virtualTourUrlForSchool(name), name);
    assert.ok(visitAddressForSchool(name), name);
    for (const photo of photos) {
      assert.equal(photo.kind, "school");
      assert.ok(photo.src);
      assert.ok(photo.thumbSrc);
      assert.ok(photo.credit);
      assert.ok(photo.license);
      assert.ok(photo.sourceUrl);
    }
  }
  assert.equal(total, 328);
});

test("unknown schools have no photos and null virtual tour", () => {
  assert.deepEqual(schoolPhotosForSchool("x", "Unknown University"), []);
  assert.equal(virtualTourUrlForSchool("Unknown University"), null);
  assert.equal(visitAddressForSchool("Unknown University"), "");
});

test("schoolPhotosHeadingName prefers paren nickname", () => {
  assert.equal(
    schoolPhotosHeadingName("Georgia Institute of Technology (Georgia Tech)"),
    "Georgia Tech",
  );
  assert.equal(schoolPhotosHeadingName("Purdue University"), "Purdue University");
});

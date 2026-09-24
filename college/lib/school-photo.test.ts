import assert from "node:assert/strict";
import test from "node:test";
import {
  websiteHref,
  websiteHostLabel,
  wikipediaTitleForSchool,
} from "./school-photo";

test("wikipedia titles use overrides for short school ids", () => {
  assert.equal(wikipediaTitleForSchool("mit", "MIT"), "Massachusetts Institute of Technology");
  assert.equal(
    wikipediaTitleForSchool("stanford-university", "Stanford University"),
    "Stanford University",
  );
});

test("website helpers normalize href and host label", () => {
  assert.equal(websiteHref("https://web.mit.edu/"), "https://web.mit.edu/");
  assert.equal(websiteHref("web.mit.edu"), "https://web.mit.edu");
  assert.equal(websiteHostLabel("https://www.berkeley.edu/"), "berkeley.edu");
  assert.equal(websiteHostLabel(""), "");
});

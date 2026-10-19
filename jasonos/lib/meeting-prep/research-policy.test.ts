import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isContactThin } from "./research-policy.ts";

const now = new Date("2026-10-19T12:00:00Z");

const full = {
  title: "Founder",
  companyId: "company-1",
  linkedinUrl: "https://www.linkedin.com/in/example",
  researchAt: "2026-10-01T12:00:00Z",
};

describe("isContactThin", () => {
  it("is thin when title, company, or LinkedIn is missing", () => {
    assert.equal(isContactThin({ ...full, title: null }, now), true);
    assert.equal(isContactThin({ ...full, title: "  " }, now), true);
    assert.equal(isContactThin({ ...full, companyId: null }, now), true);
    assert.equal(isContactThin({ ...full, linkedinUrl: "" }, now), true);
  });

  it("is thin when research is missing or older than 90 days", () => {
    assert.equal(isContactThin({ ...full, researchAt: null }, now), true);
    assert.equal(isContactThin({ ...full, researchAt: "not-a-date" }, now), true);
    assert.equal(isContactThin({ ...full, researchAt: "2026-07-20T12:00:00Z" }, now), true);
  });

  it("is not thin when the profile is filled and research is within 90 days", () => {
    assert.equal(isContactThin(full, now), false);
    assert.equal(isContactThin({ ...full, researchAt: "2026-07-21T12:00:00Z" }, now), false);
  });
});

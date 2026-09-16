import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  companyHomepageFromUrl,
  pickBestCompanyUrl,
  pickCompanyUrlFromText,
  rankCompanyUrl,
} from "./work-search-url.ts";

describe("companyHomepageFromUrl", () => {
  it("collapses a careers path to the company homepage", () => {
    assert.equal(
      companyHomepageFromUrl("https://www.acmerobotics.com/careers/cmo?utm=1"),
      "https://www.acmerobotics.com/"
    );
  });

  it("strips careers subdomains", () => {
    assert.equal(
      companyHomepageFromUrl("https://careers.stripe.com/jobs/abc"),
      "https://stripe.com/"
    );
  });

  it("rejects job boards and ATS hosts", () => {
    assert.equal(
      companyHomepageFromUrl("https://boards.greenhouse.io/acme/jobs/123"),
      null
    );
    assert.equal(
      companyHomepageFromUrl("https://www.linkedin.com/jobs/view/4291001234"),
      null
    );
    assert.equal(companyHomepageFromUrl("https://en.wikipedia.org/wiki/Acme"), null);
  });
});

describe("rankCompanyUrl", () => {
  it("scores a hostname that contains the company name highly", () => {
    const home = rankCompanyUrl("https://www.acmerobotics.com/", {
      company: "Acme Robotics",
    });
    const miss = rankCompanyUrl("https://random-directory.com/", {
      company: "Acme Robotics",
    });
    assert.ok(home > miss);
    assert.ok(home >= 25);
    assert.ok(miss < 25);
  });
});

describe("pickCompanyUrlFromText", () => {
  it("ignores Greenhouse and tracking URLs and keeps the company site", () => {
    const jd = `
https://fonts.googleapis.com/css?family=Inter
Apply at https://boards.greenhouse.io/acmerobotics/jobs/99
Company site: https://www.acmerobotics.com/about
    `;
    assert.equal(
      pickCompanyUrlFromText(jd, { company: "Acme Robotics" }),
      "https://www.acmerobotics.com/"
    );
  });

  it("promotes a www URL without a scheme", () => {
    assert.equal(
      pickCompanyUrlFromText("Visit www.kupermanadvisors.com for more", {
        company: "Kuperman Advisors",
      }),
      "https://www.kupermanadvisors.com/"
    );
  });
});

describe("pickBestCompanyUrl", () => {
  it("prefers the official homepage over news and job-board links", () => {
    const best = pickBestCompanyUrl(
      [
        "https://www.techcrunch.com/2024/01/01/acme-raises",
        "https://jobs.lever.co/acme/cmo",
        "https://acme.com/about",
      ],
      { company: "Acme" }
    );
    assert.equal(best?.url, "https://acme.com/");
  });
});

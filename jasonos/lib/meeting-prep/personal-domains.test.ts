import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  companyDomainFromEmail,
  emailDomain,
  isPersonalEmailDomain,
} from "./personal-domains.ts";

describe("companyDomainFromEmail", () => {
  it("returns the company host for a work email", () => {
    assert.equal(companyDomainFromEmail("molly.millar@crispmedia.ca"), "crispmedia.ca");
    assert.equal(companyDomainFromEmail("john@vantafive.com"), "vantafive.com");
  });

  it("skips personal domains", () => {
    assert.equal(companyDomainFromEmail("jason@gmail.com"), null);
    assert.equal(companyDomainFromEmail("a@icloud.com"), null);
    assert.equal(companyDomainFromEmail("a@me.com"), null);
    assert.equal(companyDomainFromEmail("a@yahoo.com"), null);
    assert.equal(companyDomainFromEmail("a@outlook.com"), null);
    assert.equal(isPersonalEmailDomain("gmail.com"), true);
    assert.equal(emailDomain("bad"), null);
  });
});

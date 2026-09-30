import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INTRO_FORWARD_END,
  INTRO_FORWARD_START,
  extractForwardBlock,
  introEmailSubject,
  normalizeIntroWish,
  serializeIntroWishlist,
} from "./intro-email";

describe("intro wishlist", () => {
  it("normalizes LinkedIn and rationale fields", () => {
    const wish = normalizeIntroWish({
      name: " Ed Engels ",
      company: "Wipro",
      linkedinUrl: " https://www.linkedin.com/in/ed ",
      rationale: " Overlap on enterprise GTM. ",
      agreed: true,
    });
    assert.ok(wish);
    assert.equal(wish.name, "Ed Engels");
    assert.equal(wish.linkedinUrl, "https://www.linkedin.com/in/ed");
    assert.equal(wish.agreed, true);
  });

  it("drops empty wishlist rows on serialize", () => {
    const rows = serializeIntroWishlist([
      { name: "", company: "", linkedinUrl: "", rationale: "" },
      { name: "Danny", company: "", linkedinUrl: "", rationale: "" },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.name, "Danny");
  });
});

describe("forward block", () => {
  it("extracts the fenced paste section", () => {
    const body = `Hi Andrew,

Thanks for the intro offer.

${INTRO_FORWARD_START}
Hi Ed,

Jason here. Short note.

Jason Kuperman
${INTRO_FORWARD_END}

Thanks,
Jason`;
    const block = extractForwardBlock(body);
    assert.match(block ?? "", /^Hi Ed,/);
    assert.match(block ?? "", /Jason Kuperman/);
    assert.doesNotMatch(block ?? "", /Forward this/);
  });

  it("builds a clear subject", () => {
    assert.equal(introEmailSubject("Ed Engels"), "Intro to Ed Engels");
  });
});

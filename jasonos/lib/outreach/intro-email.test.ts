import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INTRO_FORWARD_END,
  INTRO_FORWARD_START,
  extractForwardBlock,
  introEmailSubject,
  introMailtoUrl,
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
    assert.equal(wish.requestEmailSent, false);
    assert.equal(wish.introMade, false);
  });

  it("persists request sent and intro made flags", () => {
    const rows = serializeIntroWishlist([
      {
        name: "Ed",
        company: "",
        linkedinUrl: "",
        rationale: "",
        requestEmailSent: true,
        introMade: true,
      },
    ]);
    assert.equal(rows[0]?.requestEmailSent, true);
    assert.equal(rows[0]?.introMade, true);
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
  it("extracts the dashed paste section", () => {
    const body = `Hi Andrew,

Thanks for offering to intro me to Ed. His profile is here:
https://www.linkedin.com/in/ed-engles/

${INTRO_FORWARD_START}
Hi Ed,

I wanted to connect you with Jason Kuperman. Would you be open to a Zoom?

Andrew
${INTRO_FORWARD_END}

Thanks,
Jason`;
    assert.equal(INTRO_FORWARD_START, "--------------------");
    assert.equal(INTRO_FORWARD_END, "--------------------");
    const block = extractForwardBlock(body);
    assert.match(block ?? "", /^Hi Ed,/);
    assert.match(block ?? "", /connect you with Jason/);
    assert.match(block ?? "", /Andrew$/);
    assert.doesNotMatch(block ?? "", /Forward this/);
    assert.doesNotMatch(block ?? "", /Thanks for offering/);
  });

  it("still extracts legacy Forward this markers", () => {
    const body = `Hi Andrew,

---------- Forward this ----------
Hi Ed,

Legacy block.

Andrew
---------- End forward ----------

Thanks,
Jason`;
    const block = extractForwardBlock(body);
    assert.equal(block, "Hi Ed,\n\nLegacy block.\n\nAndrew");
  });

  it("builds a clear subject", () => {
    assert.equal(introEmailSubject("Ed Engels"), "Intro to Ed Engels");
  });

  it("encodes mailto spaces as %20 so Apple Mail does not show pluses", () => {
    const url = introMailtoUrl({
      to: "andrew@example.com",
      subject: "Intro to Ed",
      body: "Hi Andrew,\n\nPaste this note.",
    });
    assert.match(url, /^mailto:andrew@example\.com\?/);
    assert.match(url, /body=Hi%20Andrew/);
    assert.doesNotMatch(url, /body=Hi\+/);
    assert.doesNotMatch(url, /\+Paste\+/);
  });
});

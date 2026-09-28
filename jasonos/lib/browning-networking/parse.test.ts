import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodeOutlookSafelink,
  isTracyHandoff,
  linkedInUrlFromText,
  parseAvailabilityWindow,
  parseHandoff,
} from "./parse";
import { HANDOFF_OPENING, TRACY_EMAIL } from "./types";

const MATT = `
${HANDOFF_OPENING}

Jason, Matt replied to the outreach. I am copying you so you can find a time.

Tracy

-----Original Message-----
From: Matt Brennan <matt.brennan@example.com>
I am interested in comparing notes. I only take calls after 5pm.
Matt Brennan
(917) 555-0142
https://nam12.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fmbd74%2F&data=05%7C02%7Cjason
`;

const TIM = `
${HANDOFF_OPENING}

Copying Jason.

-----Original Message-----
From: Tim Serewicz <tim@northline.example>
I replied because your note on commercialization and GTM matched the work we are doing.
Tim Serewicz
VP Marketing at Northline
https://nam12.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fserewicz&data=abc
`;

describe("handoff parse", () => {
  it("accepts Tracy's handoff and ignores her cold email", () => {
    assert.equal(isTracyHandoff(TRACY_EMAIL, MATT), true);
    assert.equal(
      isTracyHandoff("someone@executivejobsearch.net", MATT),
      false
    );
    assert.equal(
      isTracyHandoff(TRACY_EMAIL, "Just checking you saw my last note."),
      false
    );
  });

  it("decodes Outlook safelinks to the LinkedIn slug", () => {
    const matt = linkedInUrlFromText(MATT);
    const tim = linkedInUrlFromText(TIM);
    assert.equal(matt, "https://www.linkedin.com/in/mbd74");
    assert.equal(tim, "https://www.linkedin.com/in/serewicz");
    assert.equal(
      decodeOutlookSafelink(
        "https://nam12.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fmbd74%2F&data=05"
      ),
      "https://www.linkedin.com/in/mbd74/"
    );
  });

  it("pulls Matt's name, phone, email, and after-5pm window", () => {
    const parsed = parseHandoff(MATT);
    assert.equal(parsed.name, "Matt Brennan");
    assert.equal(parsed.email, "matt.brennan@example.com");
    assert.equal(parsed.phone, "(917) 555-0142");
    assert.match(parsed.availabilityNote ?? "", /after 5pm/i);
    const window = parseAvailabilityWindow(parsed.availabilityNote);
    assert.equal(window.earliestStartMin, 17 * 60);
  });

  it("keeps Tim's reason for replying", () => {
    const parsed = parseHandoff(TIM);
    assert.equal(parsed.name, "Tim Serewicz");
    assert.match(parsed.whyTheyReplied ?? "", /commercialization and GTM/i);
    assert.equal(parsed.title, "VP Marketing");
    assert.equal(parsed.company, "Northline");
  });
});

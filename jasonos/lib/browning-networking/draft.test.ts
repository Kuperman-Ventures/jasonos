import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findBookedCall } from "./booking";
import {
  briefFromHandoff,
  gmailComposeUrl,
  schedulingDraft,
  thankYouDraft,
} from "./draft";
import { parseHandoff } from "./parse";
import { HANDOFF_OPENING } from "./types";

describe("drafts and booking", () => {
  it("writes the same short reply for every contact", () => {
    const body = schedulingDraft({
      name: "Matt Brennan",
      slots: [
        {
          id: "a",
          start: "2026-10-01T14:00:00.000Z",
          end: "2026-10-01T14:30:00.000Z",
        },
      ],
    });
    assert.match(body, /Thank you Tracy - moving you to Bcc/);
    assert.match(body, /Good to be connected to Matt\./);
    assert.match(body, /Let me know what might work for a call in the next few weeks\./);
    assert.match(body, /Some options from my side would be:/);
    assert.match(body, /Thu\. Oct 1 @ 10:00am ET/);
    assert.match(body, /Looking forward to speaking,\nJason$/);
    assert.doesNotMatch(body, /!/);
    const url = gmailComposeUrl({
      to: "matt.brennan@example.com",
      bcc: "traceys@executivejobsearch.net",
      subject: "Re: Executive Networking",
      body,
      accountEmail: "jason@kupermanadvisors.com",
    });
    assert.match(url, /bcc=traceys%40executivejobsearch.net/);
    assert.doesNotMatch(url, /[?&]cc=/);
    assert.match(url, /mail\/u\/jason%40kupermanadvisors.com/);
  });

  it("builds a job-networking brief from what they wrote", () => {
    const parsed = parseHandoff(`
${HANDOFF_OPENING}
-----Original Message-----
From: Tim Serewicz <tim@northline.example>
I replied because your note on commercialization and GTM matched the work we are doing.
`);
    const brief = briefFromHandoff(parsed);
    assert.match(brief.why, /commercialization and GTM/);
    assert.match(brief.overlap, /OUTFRONT/);
    assert.equal(brief.questions.length, 3);
    assert.match(brief.ask, /Two names/);
  });

  it("thanks them with a line from the transcript and nothing invented", () => {
    const draft = thankYouDraft({
      name: "Tim Serewicz",
      summary:
        "Tim said the commercialization problem is the handoff between product and sales.",
    });
    assert.match(draft, /^Tim,/);
    assert.match(draft, /commercialization problem/);
    assert.doesNotMatch(draft, /delighted|circle back|synergy/i);
  });

  it("treats a calendar guest with their email as booked", () => {
    const hit = findBookedCall(
      [
        {
          id: "evt-1",
          summary: "Networking",
          start: "2026-10-06T21:00:00.000Z",
          end: "2026-10-06T21:30:00.000Z",
          attendees: [
            { email: "jason@kupermanadvisors.com", self: true },
            { email: "Matt.Brennan+jobs@example.com", responseStatus: "accepted" },
          ],
        },
      ],
      { email: "matt.brennan@example.com", name: "Matt Brennan" },
      new Date("2026-10-01T12:00:00.000Z")
    );
    assert.equal(hit?.id, "evt-1");

    const declined = findBookedCall(
      [
        {
          id: "evt-2",
          summary: "Matt Brennan",
          start: "2026-10-06T21:00:00.000Z",
          attendees: [{ email: "matt.brennan@example.com", responseStatus: "declined" }],
        },
      ],
      { email: "other@example.com", name: "Matt Brennan" },
      new Date("2026-10-01T12:00:00.000Z")
    );
    assert.equal(declined?.id, "evt-2");
  });
});

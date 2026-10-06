import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findBookedCall } from "./booking";
import {
  briefFromHandoff,
  connectMeetingTitle,
  packetEmailDraft,
  packetEmailSubject,
  packetLinkedInDraft,
  replyComposeUrl,
  schedulingDraft,
  thankYouDraft,
} from "./draft";
import { parseHandoff } from "./parse";
import { HANDOFF_OPENING } from "./types";

describe("drafts and booking", () => {
  it("names the invite so both calendars show both people", () => {
    assert.equal(
      connectMeetingTitle("Matthew Deutsch"),
      "Jason Kuperman/Matthew Deutsch: Connect"
    );
    assert.equal(
      connectMeetingTitle("  Timothy Serewicz  "),
      "Jason Kuperman/Timothy Serewicz: Connect"
    );
  });

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
    const url = replyComposeUrl({
      to: "matt.brennan@example.com",
      bcc: "traceys@executivejobsearch.net",
      subject: "Re: Executive Networking",
      body,
    });
    assert.match(url, /^mailto:matt\.brennan@example\.com\?/);
    assert.match(url, /bcc=traceys%40executivejobsearch\.net/);
    assert.match(url, new RegExp(encodeURIComponent("Thu. Oct 1 @ 10:00am ET")));
    assert.doesNotMatch(url, /[?&]cc=/);
    assert.doesNotMatch(url, /outlook\.live\.com|mail\.google\.com/);
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

  it("writes a first-touch note when Tracy did not CC the person", () => {
    const body = packetEmailDraft({
      name: "Sarah Chen",
      slots: [
        {
          id: "a",
          start: "2026-10-15T14:00:00.000Z",
          end: "2026-10-15T14:30:00.000Z",
        },
      ],
    });
    assert.match(body, /^Sarah,/);
    assert.match(body, /Tracy at Browning suggested we connect/);
    assert.match(body, /Some options from my side would be:/);
    assert.match(body, /Let me know if any of those are good or days\/times that would work for you\./);
    assert.match(body, /Looking forward to speak\.\n\nBest,\nJason$/);
    assert.doesNotMatch(body, /Thank you Tracy/);
    assert.doesNotMatch(body, /Good to be connected/);
    const li = packetLinkedInDraft("Sarah Chen");
    assert.match(li, /^Sarah,/);
    assert.match(li, /Tracy at Browning/);
    assert.equal(packetEmailSubject("Sarah Chen"), "Jason Kuperman / Sarah Chen");
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

  it("skips Granola next-step paste and writes a first-person LinkedIn close", () => {
    const draft = thankYouDraft({
      name: "Matthew Deutsch",
      summary: `# Matt Deutsch: Background
- 10 years Air Force project management, then Wayfair 3D department (product imagery)
- Director of PM at a 3D visualization company, led 17-person international team for 3 years

# 3D Visualization and AI Disruption
- Matt's take: AI is faster, cheaper, and improving; humans are "fixed".
- Matt's former 3D company: clients paying hundreds of thousands/year; he doubts it survives 2 more years.

# Next Steps
- **Intro Matt to Eddie (custom sunglass startup founder)** (Jason)
  Matt's 3D and product visualization background is directly relevant.
- **Connect on LinkedIn with Matt** (Jason)
  Matt suggested checking his profile; Jason hadn't connected yet by end of call.`,
    });
    assert.match(draft, /^Matthew,/);
    assert.match(draft, /Thanks for the call\./);
    assert.match(draft, /I'll connect on LinkedIn\./);
    assert.match(draft, /I'll make the intro to Eddie\./);
    assert.doesNotMatch(draft, /Connect on LinkedIn with Matt \(Jason\)/i);
    assert.doesNotMatch(draft, /Jason hadn't connected/i);
    assert.doesNotMatch(draft, /Next Steps/i);
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

  it("matches Matt/Jason Connect to Matt Ramerman by first-name title", () => {
    const hit = findBookedCall(
      [
        {
          id: "evt-matt",
          summary: "Matt/Jason Connect",
          start: "2026-10-06T18:00:00.000Z",
          end: "2026-10-06T18:45:00.000Z",
          attendees: [
            { email: "jason@kupermanadvisors.com", self: true },
            { email: "matt@ramermancommunications.com", responseStatus: "needsAction" },
          ],
        },
      ],
      { email: null, name: "Matt Ramerman" },
      new Date("2026-09-30T17:00:00.000Z")
    );
    assert.equal(hit?.id, "evt-matt");
  });
});

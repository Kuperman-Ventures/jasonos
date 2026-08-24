import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  htmlToPlaintext,
  looksLikeOutlookWrap,
  parseForwardedContent,
  parseForwardedMailDate,
  stripForwardPrefixes,
  unwrapOutlookForward,
} from "./unwrap-forwarded-mail.ts";

const OUTLOOK = "jason.kuperman@outlook.com";
const GMAIL = "jskuperman@gmail.com";
const ADVISORS = "jason@kupermanadvisors.com";

describe("looksLikeOutlookWrap", () => {
  it("detects Outlook From", () => {
    assert.equal(
      looksLikeOutlookWrap({ from: `Jason Kuperman <${OUTLOOK}>` }),
      true
    );
  });

  it("detects Outlook Reply-To even if From is missing the address casing", () => {
    assert.equal(
      looksLikeOutlookWrap({
        from: "Jason Kuperman <JASON.KUPERMAN@OUTLOOK.COM>",
        replyTo: OUTLOOK,
      }),
      true
    );
  });

  it("ignores a random FW: from someone else", () => {
    assert.equal(
      looksLikeOutlookWrap({
        from: "Jane Doe <jane@acme.com>",
        subject: "FW: Intro to Jason",
      }),
      false
    );
  });
});

describe("stripForwardPrefixes", () => {
  it("strips stacked FW/Fwd/Re prefixes", () => {
    assert.equal(stripForwardPrefixes("FW: Fwd: Re: Coffee next week"), "Coffee next week");
  });
});

describe("parseForwardedMailDate", () => {
  it("parses Outlook Sent headers", () => {
    const parsed = parseForwardedMailDate("Monday, August 18, 2026 3:42 PM");
    assert.ok(parsed);
    assert.equal(parsed.toISOString(), "2026-08-18T15:42:00.000Z");
  });

  it("parses Gmail Date headers with 'at'", () => {
    const parsed = parseForwardedMailDate("Mon, Aug 18, 2026 at 3:42 PM");
    assert.ok(parsed);
    assert.equal(parsed.toISOString(), "2026-08-18T15:42:00.000Z");
  });

  it("returns null for garbage", () => {
    assert.equal(parseForwardedMailDate(""), null);
    assert.equal(parseForwardedMailDate("soonish"), null);
  });
});

describe("Outlook plaintext forward", () => {
  const body = `Jason — fyi

From: Jane Doe <jane@acme.com>
Sent: Monday, August 18, 2026 3:42 PM
To: Jason Kuperman <${OUTLOOK}>
Cc: Bob Smith <bob@acme.com>
Subject: Re: Coffee next week

Hi Jason,

Are you free Thursday at 2pm?

Thanks,
Jane
`;

  it("pulls original From/To/Cc/Subject/body", () => {
    const parsed = unwrapOutlookForward({
      from: `Jason Kuperman <${OUTLOOK}>`,
      to: ADVISORS,
      subject: "FW: Re: Coffee next week",
      plaintextBody: body,
    });
    assert.ok(parsed);
    assert.equal(parsed.fromEmail, "jane@acme.com");
    assert.equal(parsed.fromName, "Jane Doe");
    assert.equal(parsed.from, "Jane Doe <jane@acme.com>");
    assert.equal(parsed.to, `Jason Kuperman <${OUTLOOK}>`);
    assert.equal(parsed.cc, "Bob Smith <bob@acme.com>");
    assert.equal(parsed.subject, "Coffee next week");
    assert.match(parsed.body, /Are you free Thursday at 2pm\?/);
    assert.doesNotMatch(parsed.body, /Jason — fyi/);
    assert.doesNotMatch(parsed.body, /^From:/m);
    assert.equal(parsed.date, "Monday, August 18, 2026 3:42 PM");
    const sentAt = parseForwardedMailDate(parsed.date);
    assert.ok(sentAt);
    assert.equal(sentAt.toISOString(), "2026-08-18T15:42:00.000Z");
  });
});

describe("Outlook [mailto:] plaintext forward", () => {
  const body = `-----Original Message-----
From: Pat Lee [mailto:pat.lee@firm.com]
Sent: Tuesday, August 19, 2026 9:15 AM
To: Jason Kuperman
Subject: Intro

Jason, meet Alex.

Pat
`;

  it("parses mailto-style From", () => {
    const parsed = unwrapOutlookForward({
      from: OUTLOOK,
      to: GMAIL,
      subject: "FW: Intro",
      plaintextBody: body,
    });
    assert.ok(parsed);
    assert.equal(parsed.fromEmail, "pat.lee@firm.com");
    assert.equal(parsed.fromName, "Pat Lee");
    assert.equal(parsed.subject, "Intro");
    assert.match(parsed.body, /Jason, meet Alex/);
  });
});

describe("Outlook HTML forward", () => {
  const html = `<html><body>
<p>fyi</p>
<div>
<b>From:</b> Alex Rivera &lt;alex.rivera@lighthouse.com&gt;<br>
<b>Sent:</b> Wednesday, August 20, 2026 11:04 AM<br>
<b>To:</b> Jason Kuperman &lt;${OUTLOOK}&gt;<br>
<b>Subject:</b> Fwd: Board intro
</div>
<p>Jason — looping you in on the board conversation.</p>
<p>Best,<br>Alex</p>
</body></html>`;

  it("unwraps From/Subject/body from HTML when plaintext is empty", () => {
    const parsed = unwrapOutlookForward({
      from: `Jason <${OUTLOOK}>`,
      to: ADVISORS,
      subject: "FW: Board intro",
      plaintextBody: "",
      htmlBody: html,
    });
    assert.ok(parsed);
    assert.equal(parsed.fromEmail, "alex.rivera@lighthouse.com");
    assert.equal(parsed.fromName, "Alex Rivera");
    assert.equal(parsed.subject, "Board intro");
    assert.match(parsed.body, /looping you in on the board conversation/);
    assert.doesNotMatch(parsed.body, /^fyi$/m);
  });

  it("htmlToPlaintext keeps From: lines intact", () => {
    const text = htmlToPlaintext(html);
    assert.match(text, /From:\s*Alex Rivera <alex\.rivera@lighthouse\.com>/);
    assert.match(text, /Subject:\s*Fwd: Board intro/);
  });
});

describe("Gmail forwarded-message format", () => {
  const body = `---------- Forwarded message ---------
From: Sam Chen <sam.chen@example.org>
Date: Mon, Aug 18, 2026 at 3:42 PM
Subject: Q3 pipeline
To: Jason Kuperman <${OUTLOOK}>

Sam here — numbers attached in the original thread.

On Fri, Aug 15, Sam wrote:
> prior quote that should remain in the original body
`;

  it("parses the Gmail separator block", () => {
    const parsed = unwrapOutlookForward({
      from: OUTLOOK,
      to: GMAIL,
      subject: "Fwd: Q3 pipeline",
      plaintextBody: body,
    });
    assert.ok(parsed);
    assert.equal(parsed.fromEmail, "sam.chen@example.org");
    assert.equal(parsed.fromName, "Sam Chen");
    assert.equal(parsed.subject, "Q3 pipeline");
    assert.equal(parsed.to, `Jason Kuperman <${OUTLOOK}>`);
    assert.match(parsed.body, /Sam here — numbers attached/);
    assert.match(parsed.body, /prior quote that should remain/);
    assert.equal(parsed.date, "Mon, Aug 18, 2026 at 3:42 PM");
    const sentAt = parseForwardedMailDate(parsed.date);
    assert.ok(sentAt);
    assert.equal(sentAt.toISOString(), "2026-08-18T15:42:00.000Z");
  });
});

describe("Gmail HTML forwarded-message", () => {
  const html = `<div dir="ltr"><br><br><div class="gmail_quote">
<div dir="ltr" class="gmail_attr">---------- Forwarded message ---------<br>
From: <strong class="gmail_sendername">Riley Fox</strong> <span>&lt;<a href="mailto:riley@shop.co">riley@shop.co</a>&gt;</span><br>
Date: Thu, Aug 21, 2026 at 8:01 AM<br>
Subject: Re: Follow up<br>
To: Jason Kuperman &lt;${OUTLOOK}&gt;<br>
</div>
<div>Can we push Friday to next week?</div>
</div></div>`;

  it("unwraps a Gmail HTML quote block", () => {
    const parsed = unwrapOutlookForward({
      from: `Jason Kuperman <${OUTLOOK}>`,
      replyTo: OUTLOOK,
      to: ADVISORS,
      subject: "Fwd: Follow up",
      htmlBody: html,
    });
    assert.ok(parsed);
    assert.equal(parsed.fromEmail, "riley@shop.co");
    assert.equal(parsed.fromName, "Riley Fox");
    assert.match(parsed.body, /push Friday to next week/);
  });
});

describe("Jason's own outbound forwarded into Gmail", () => {
  const body = `---------- Forwarded message ---------
From: Jason Kuperman <${ADVISORS}>
Date: Mon, Aug 18, 2026 at 10:00 AM
Subject: Checking in
To: Morgan Lee <morgan@buyer.com>

Morgan — quick note from last week. Free for a call Thursday?
- Jason
`;

  it("keeps original From as Jason and To as the counterparty", () => {
    const parsed = unwrapOutlookForward({
      from: OUTLOOK,
      to: GMAIL,
      subject: "FW: Checking in",
      plaintextBody: body,
    });
    assert.ok(parsed);
    assert.equal(parsed.fromEmail, ADVISORS);
    assert.equal(parsed.to, "Morgan Lee <morgan@buyer.com>");
    assert.match(parsed.body, /Free for a call Thursday/);
  });
});

describe("nested quotes", () => {
  const body = `---------- Forwarded message ---------
From: Outer Person <outer@x.com>
Date: Mon, Aug 18, 2026 at 1:00 PM
Subject: Looping you in
To: Jason Kuperman <${OUTLOOK}>

See below.

---------- Forwarded message ---------
From: Inner Person <inner@x.com>
Date: Mon, Aug 18, 2026 at 12:00 PM
Subject: Original ask
To: Outer Person <outer@x.com>

The original ask lives here.
`;

  it("uses the outermost forwarded From, keeps nested content in the body", () => {
    const parsed = unwrapOutlookForward({
      from: OUTLOOK,
      to: ADVISORS,
      subject: "FW: Looping you in",
      plaintextBody: body,
    });
    assert.ok(parsed);
    assert.equal(parsed.fromEmail, "outer@x.com");
    assert.match(parsed.body, /The original ask lives here/);
  });
});

describe("failure cases", () => {
  it("returns null when Outlook wrap has no parseable headers", () => {
    const parsed = unwrapOutlookForward({
      from: OUTLOOK,
      to: GMAIL,
      subject: "notes",
      plaintextBody: "just a thought, no headers here",
    });
    assert.equal(parsed, null);
  });

  it("does not unwrap a third-party forward even if the body would parse", () => {
    const parsed = unwrapOutlookForward({
      from: "Other Person <other@else.com>",
      subject: "FW: Coffee next week",
      plaintextBody: `From: Jane Doe <jane@acme.com>
Sent: Monday, August 18, 2026 3:42 PM
To: Other Person <other@else.com>
Subject: Coffee next week

Hi
`,
    });
    assert.equal(parsed, null);
  });

  it("parseForwardedContent still works without the Outlook gate", () => {
    const parsed = parseForwardedContent({
      plaintext: `From: Jane Doe <jane@acme.com>
Sent: Monday, August 18, 2026 3:42 PM
To: Someone <x@y.com>
Subject: Hi

Body
`,
    });
    assert.ok(parsed);
    assert.equal(parsed.fromEmail, "jane@acme.com");
  });
});

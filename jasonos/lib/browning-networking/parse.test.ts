import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chooseHandoffs,
  decodeOutlookSafelink,
  isTracyHandoff,
  linkedInUrlFromText,
  parseAvailabilityWindow,
  parseHandoff,
  sameCandidate,
  type HandoffMail,
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

  it("accepts Tracy's real copy-you wording and the resume packet", () => {
    const intro = `Good Morning Matt,
(551-427-6711)
Thank you for your reply and interest in Executive Networking with Jason Kuperman.
** https://na01.safelinks.protection.outlook.com/?url=http%3A%2F%2Flinkedin.com%2Fin%2Fmbd74&data=05
On 2026-09-23 12:53, Matt Deutsch wrote:
I am happy to connect with Jason. I am available Thursday, or Friday after 5pm or any day next week after 5.
Thanks`;
    assert.equal(isTracyHandoff(TRACY_EMAIL, intro), true);
    const parsed = parseHandoff(intro);
    assert.equal(parsed.name, "Matt Deutsch");
    assert.equal(parsed.phone, "(551) 427-6711");
    assert.equal(parsed.linkedinUrl, "https://www.linkedin.com/in/mbd74");
    assert.match(parsed.availabilityNote ?? "", /after 5pm/i);

    const resume = `Dear Jason,\nAttached please find the resume for Matthew Deutsch.`;
    assert.equal(isTracyHandoff(TRACY_EMAIL, resume), true);
    assert.equal(sameCandidate("Matt Deutsch", "Matthew Deutsch"), true);
    assert.equal(sameCandidate("Tim Serewicz", "Timothy Serewicz"), true);
  });

  it("keeps one handoff when Tracy also sends the resume", () => {
    const intro = mail({
      messageId: "intro",
      receivedAt: "2026-09-28T14:06:00Z",
      subject: "Re: Introduction to Senior Marketing Executive",
      to: "deutsch74@gmail.com",
      body: `Thank you for your reply and interest in Executive Networking with Jason Kuperman.
On 2026-09-23 12:53, Matt Deutsch wrote:
I am available Thursday after 5pm.`,
    });
    const resume = mail({
      messageId: "resume",
      receivedAt: "2026-09-28T14:10:00Z",
      subject: "Jason Kuperman & Matthew Deutsch",
      to: "jason.kuperman@outlook.com",
      body: "Dear Jason, Attached please find the resume for Matthew Deutsch.",
    });
    const chosen = chooseHandoffs([resume, intro]);
    assert.equal(chosen.length, 1);
    assert.equal(chosen[0].mail.messageId, "intro");
    assert.equal(chosen[0].kind, "intro");
    assert.equal(chosen[0].parsed.name, "Matthew Deutsch");
    assert.equal(chosen[0].parsed.email, "deutsch74@gmail.com");
  });

  it("turns a names-and-LinkedIn packet into first-touch handoffs, not a reply thread", () => {
    const packet = mail({
      messageId: "packet",
      receivedAt: "2026-10-06T14:00:00Z",
      subject: "Networking contacts",
      to: "jason.kuperman@outlook.com",
      body: `Dear Jason,
Attached are the resumes and LinkedIn profiles.

Sarah Chen
https://www.linkedin.com/in/sarahchenpm

Robert Hale
https://linkedin.com/in/roberthale

Tracy`,
    });
    const chosen = chooseHandoffs([packet]);
    assert.equal(chosen.length, 2);
    assert.equal(chosen[0].kind, "packet");
    assert.equal(chosen[1].kind, "packet");
    const names = chosen.map((item) => item.parsed.name).sort();
    assert.deepEqual(names, ["Robert Hale", "Sarah Chen"]);
    assert.equal(
      chosen.find((item) => item.parsed.name === "Sarah Chen")?.parsed.linkedinUrl,
      "https://www.linkedin.com/in/sarahchenpm"
    );
    assert.equal(
      chosen.every((item) => item.parsed.email === null),
      true
    );
  });

  it("treats a Jason Kuperman & Name resume with no intro CC as a packet", () => {
    const resume = mail({
      messageId: "resume-only",
      receivedAt: "2026-10-06T15:00:00Z",
      subject: "Jason Kuperman & Jane Smith",
      to: "jason.kuperman@outlook.com",
      body: "Please see the attached resume and LinkedIn.\nhttps://www.linkedin.com/in/jane-smith-pm",
    });
    const chosen = chooseHandoffs([resume]);
    assert.equal(chosen.length, 1);
    assert.equal(chosen[0].kind, "packet");
    assert.equal(chosen[0].parsed.name, "Jane Smith");
    assert.equal(chosen[0].parsed.linkedinUrl, "https://www.linkedin.com/in/jane-smith-pm");
  });

  it("ignores a Tracy check-in that is not an intro or a packet", () => {
    assert.equal(
      isTracyHandoff(TRACY_EMAIL, "Just checking you saw my last note.", "Checking in"),
      false
    );
  });

  it("reads names and LinkedIn when Tracy wraps profiles in HTML links", () => {
    const packet = mail({
      messageId: "html-packet",
      receivedAt: "2026-10-06T16:00:00Z",
      subject: "Networking contacts",
      to: "jason.kuperman@outlook.com",
      body: `<p>Dear Jason,</p>
<p>Please find the attached resumes and LinkedIn profiles.</p>
<p><a href="https://www.linkedin.com/in/sarahchenpm">Sarah Chen</a></p>
<p><a href="https://nam12.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.linkedin.com%2Fin%2Froberthale">Robert Hale</a></p>
<p>Tracy</p>`,
    });
    assert.equal(isTracyHandoff(TRACY_EMAIL, packet.body, packet.subject), true);
    const chosen = chooseHandoffs([packet]);
    assert.equal(chosen.length, 2);
    assert.equal(chosen.every((item) => item.kind === "packet"), true);
    const names = chosen.map((item) => item.parsed.name).sort();
    assert.deepEqual(names, ["Robert Hale", "Sarah Chen"]);
    assert.equal(
      chosen.find((item) => item.parsed.name === "Sarah Chen")?.parsed.linkedinUrl,
      "https://www.linkedin.com/in/sarahchenpm"
    );
    assert.equal(
      chosen.find((item) => item.parsed.name === "Robert Hale")?.parsed.linkedinUrl,
      "https://www.linkedin.com/in/roberthale"
    );
  });

  it("keeps the intro reply when Tracy also sends a LinkedIn packet for the same person", () => {
    const intro = mail({
      messageId: "intro",
      receivedAt: "2026-10-06T14:00:00Z",
      subject: "Re: Introduction to Senior Marketing Executive",
      to: "sarah.chen@example.com",
      body: `Thank you for your reply and interest in Executive Networking with Jason Kuperman.
On 2026-10-01, Sarah Chen wrote:
I am available Thursday after 5pm.`,
    });
    const packet = mail({
      messageId: "packet",
      receivedAt: "2026-10-06T14:10:00Z",
      subject: "Networking contacts",
      to: "jason.kuperman@outlook.com",
      body: `Dear Jason,
Attached are the resume and LinkedIn profile.

Sarah Chen
https://www.linkedin.com/in/sarahchenpm

Tracy`,
    });
    const chosen = chooseHandoffs([packet, intro]);
    assert.equal(chosen.length, 1);
    assert.equal(chosen[0].kind, "intro");
    assert.equal(chosen[0].mail.messageId, "intro");
    assert.equal(chosen[0].resumeMessageId, "packet");
    assert.equal(chosen[0].parsed.linkedinUrl, "https://www.linkedin.com/in/sarahchenpm");
  });

  it("reads Tracy's Client to Client Outlook packet with safelink profiles", () => {
    const body = `Good Morning Jason,
Jerry wanted me to send the attached client information to you so that you may connect with them.

Please call & email at your earliest convenience.

Jon Crispin: https://na01.safelinks.protection.outlook.com/?url=http%3A%2F%2Flinkedin.com%2Fin%2FJoncrispin%2F&data=05%7C02%7C
Hardik Patel: https://na01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fhardik-patel-4161a7128%2F&data=05%7C02%7C

Have a great day!
Tracy`;
    assert.equal(isTracyHandoff(TRACY_EMAIL, body, "Client to Client"), true);
    const chosen = chooseHandoffs([
      mail({
        messageId: "client-to-client",
        receivedAt: "2026-10-06T14:54:00Z",
        subject: "Client to Client",
        to: "jason.kuperman@outlook.com",
        body,
      }),
    ]);
    assert.equal(chosen.length, 2);
    assert.equal(chosen.every((item) => item.kind === "packet"), true);
    const names = chosen.map((item) => item.parsed.name).sort();
    assert.deepEqual(names, ["Hardik Patel", "Jon Crispin"]);
    assert.equal(
      chosen.find((item) => item.parsed.name === "Jon Crispin")?.parsed.linkedinUrl,
      "https://www.linkedin.com/in/Joncrispin"
    );
    assert.equal(
      chosen.find((item) => item.parsed.name === "Hardik Patel")?.parsed.linkedinUrl,
      "https://www.linkedin.com/in/hardik-patel-4161a7128"
    );
  });
});

function mail(overrides: Partial<HandoffMail> & Pick<HandoffMail, "messageId" | "body">): HandoffMail {
  return {
    accountEmail: "jason.kuperman@outlook.com",
    threadId: null,
    rfc822MessageId: null,
    receivedAt: "2026-09-28T14:00:00Z",
    subject: null,
    from: TRACY_EMAIL,
    to: "",
    ...overrides,
  };
}

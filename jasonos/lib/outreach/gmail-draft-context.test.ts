import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDraftGmailHistorySummary,
  buildGmailHistorySummary,
  companyDomainsFromEmails,
  gmailQueryForCompanyDomains,
  gmailQueryForContactEmails,
  selectThreadMessages,
  stripQuotedReply,
  uniqueContactEmails,
  type DraftMailThread,
} from "./gmail-draft-context.ts";

describe("uniqueContactEmails", () => {
  it("dedupes primary + list, ignoring case and blanks", () => {
    assert.deepEqual(
      uniqueContactEmails({
        primaryEmail: "Sam@Firm.com",
        emails: ["sam@firm.com", "sam.alt@firm.com", " ", "not-an-email"],
      }),
      ["sam@firm.com", "sam.alt@firm.com"]
    );
  });
});

describe("gmailQueryForContactEmails", () => {
  it("searches from/to every address plus Outlook wraps", () => {
    const query = gmailQueryForContactEmails([
      "sam@firm.com",
      "sam.alt@firm.com",
    ]);
    assert.match(query ?? "", /from:sam@firm.com OR to:sam@firm.com/);
    assert.match(query ?? "", /from:sam.alt@firm.com OR to:sam.alt@firm.com/);
    assert.match(
      query ?? "",
      /from:jason.kuperman@outlook.com \(sam@firm.com OR sam.alt@firm.com\)/
    );
  });

  it("returns null when there are no emails", () => {
    assert.equal(gmailQueryForContactEmails([]), null);
  });
});

describe("stripQuotedReply", () => {
  it("keeps new text and drops the Gmail 'On ... wrote:' chain", () => {
    const body = `Thanks for this.

On Tue, Sep 1, 2026 at 4:02 PM Jason Kuperman <jason@kupermanadvisors.com> wrote:
> Wanted to pick this back up.
> - Jason`;
    assert.equal(stripQuotedReply(body), "Thanks for this.");
  });

  it("drops Outlook original-message blocks", () => {
    const body = `Got it, I'll send times.

-----Original Message-----
From: Jason Kuperman
Sent: Monday, September 1, 2026 9:00 AM
To: Sam
Subject: Follow up`;
    assert.equal(stripQuotedReply(body), "Got it, I'll send times.");
  });

  it("skips leftover > quoted lines", () => {
    const body = "Quick ping.\n\n> earlier paragraph";
    assert.equal(stripQuotedReply(body), "Quick ping.");
  });
});

describe("selectThreadMessages", () => {
  it("keeps the opener plus the newest tail on long threads", () => {
    const messages = Array.from({ length: 8 }, (_, i) => ({
      subject: i === 0 ? "Intro" : `Reply ${i}`,
      date: `2026-01-0${i + 1}T12:00:00Z`,
      plaintextBody: `msg ${i}`,
    }));
    const selected = selectThreadMessages(messages, 4);
    assert.equal(selected.length, 4);
    assert.equal(selected[0]?.plaintextBody, "msg 0");
    assert.equal(selected[1]?.plaintextBody, "msg 5");
    assert.equal(selected[3]?.plaintextBody, "msg 7");
  });
});

describe("buildGmailHistorySummary", () => {
  it("puts the newest thread first and keeps leftover snippets", () => {
    const older: DraftMailThread = {
      id: "old",
      messages: [
        {
          date: "Mon, 1 Jan 2024 12:00:00 -0500",
          from: "Sam <sam@firm.com>",
          subject: "Old thread",
          plaintextBody: "We met at Chiat in 2012.",
        },
      ],
    };
    const newer: DraftMailThread = {
      id: "new",
      messages: [
        {
          date: "Tue, 1 Sep 2026 12:00:00 -0400",
          from: "Jason <jason@kupermanadvisors.com>",
          to: "Sam <sam@firm.com>",
          subject: "Catching up",
          plaintextBody: "Free for 20 minutes next week?",
        },
        {
          date: "Wed, 2 Sep 2026 09:00:00 -0400",
          from: "Sam <sam@firm.com>",
          subject: "Re: Catching up",
          plaintextBody: "Next Thursday works.",
        },
      ],
    };

    const summary = buildGmailHistorySummary({
      searchedCount: 3,
      fullThreads: [older, newer],
      leftover: [{ id: "leftover", snippet: "Holiday note from 2023" }],
      messagesPerThread: 12,
      bodyChars: 2500,
      maxSummaryChars: 20_000,
    });

    assert.match(summary, /Found 3 Gmail thread\(s\)\. Opened 2 in full/);
    assert.match(summary, /Next Thursday works/);
    assert.match(summary, /We met at Chiat in 2012/);
    assert.match(summary, /Holiday note from 2023/);
    assert.ok(
      summary.indexOf("Catching up") < summary.indexOf("Old thread"),
      "newest thread should appear before older thread"
    );
  });
});

describe("companyDomainsFromEmails", () => {
  it("keeps a work domain and skips Gmail, Outlook, and Jason's domain", () => {
    assert.deepEqual(
      companyDomainsFromEmails([
        "sam@kornferry.com",
        "sam.alt@kornferry.com",
        "sam@gmail.com",
        "jason@kupermanadvisors.com",
        "notes@outlook.com",
      ]),
      ["kornferry.com"]
    );
  });

  it("skips google.com platform mail", () => {
    assert.deepEqual(companyDomainsFromEmails(["hiring@google.com"]), []);
  });
});

describe("gmailQueryForCompanyDomains", () => {
  it("searches the domain and excludes the recipient", () => {
    const query = gmailQueryForCompanyDomains(
      ["kornferry.com"],
      ["sam@kornferry.com"]
    );
    assert.match(query ?? "", /from:@kornferry.com OR to:@kornferry.com/);
    assert.match(query ?? "", /-from:sam@kornferry.com -to:sam@kornferry.com/);
    assert.doesNotMatch(query ?? "", /from:sam@kornferry.com OR to:sam@kornferry.com/);
  });

  it("returns null when there are no company domains", () => {
    assert.equal(gmailQueryForCompanyDomains([]), null);
  });
});

describe("buildDraftGmailHistorySummary", () => {
  it("keeps person mail first and labels company threads as background", () => {
    const person: DraftMailThread = {
      id: "person",
      messages: [
        {
          date: "Wed, 2 Sep 2026 09:00:00 -0400",
          from: "Sam <sam@kornferry.com>",
          subject: "Re: Catching up",
          plaintextBody: "Next Thursday works.",
        },
      ],
    };
    const colleague: DraftMailThread = {
      id: "colleague",
      messages: [
        {
          date: "Mon, 1 Sep 2026 12:00:00 -0400",
          from: "Alex <alex@kornferry.com>",
          subject: "CMO search update",
          plaintextBody: "The board wants a CGO more than a CMO.",
        },
      ],
    };

    const summary = buildDraftGmailHistorySummary({
      person: {
        searchedCount: 1,
        fullThreads: [person],
        leftover: [],
      },
      company: {
        domains: ["kornferry.com"],
        searchedCount: 2,
        fullThreads: [colleague],
        leftover: [{ id: "older", snippet: "Intro last year" }],
      },
      messagesPerThread: 12,
      bodyChars: 2500,
      personMaxChars: 16_000,
      companyMaxChars: 8_000,
    });

    assert.match(summary, /With this person/);
    assert.match(summary, /Next Thursday works/);
    assert.match(summary, /Same company \(kornferry.com\)/);
    assert.match(summary, /other people at the firm/);
    assert.match(summary, /The board wants a CGO more than a CMO/);
    assert.match(summary, /Intro last year/);
    assert.ok(summary.indexOf("With this person") < summary.indexOf("Same company"));
  });

  it("omits the company section when there is no firm mail", () => {
    const summary = buildDraftGmailHistorySummary({
      person: {
        searchedCount: 1,
        fullThreads: [
          {
            id: "p",
            messages: [{ plaintextBody: "Hi Sam", subject: "Hello" }],
          },
        ],
        leftover: [],
      },
      company: {
        domains: ["kornferry.com"],
        searchedCount: 0,
        fullThreads: [],
        leftover: [],
      },
      messagesPerThread: 12,
      bodyChars: 2500,
      personMaxChars: 16_000,
      companyMaxChars: 8_000,
    });
    assert.doesNotMatch(summary, /Same company/);
  });
});

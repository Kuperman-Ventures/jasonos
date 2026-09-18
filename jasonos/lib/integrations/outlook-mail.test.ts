import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dedupeOutlookMessages,
  formatGraphAddress,
  graphSinceTimestamp,
  mapGraphMessage,
  rankOutlookFolders,
  shouldSkipOutlookFolder,
  type OutlookMessage,
} from "./outlook-mail.ts";

describe("shouldSkipOutlookFolder", () => {
  it("skips junk, drafts, deleted, and outbox by well-known name or label", () => {
    assert.equal(shouldSkipOutlookFolder({ wellKnownName: "junkemail", displayName: "Junk Email" }), true);
    assert.equal(shouldSkipOutlookFolder({ wellKnownName: "drafts", displayName: "Drafts" }), true);
    assert.equal(shouldSkipOutlookFolder({ displayName: "Deleted Items" }), true);
    assert.equal(shouldSkipOutlookFolder({ displayName: "Outbox" }), true);
    assert.equal(shouldSkipOutlookFolder({ displayName: "Clutter" }), true);
  });

  it("keeps sent, inbox, archive, and custom folders", () => {
    assert.equal(shouldSkipOutlookFolder({ wellKnownName: "sentitems", displayName: "Sent Items" }), false);
    assert.equal(shouldSkipOutlookFolder({ wellKnownName: "inbox", displayName: "Inbox" }), false);
    assert.equal(shouldSkipOutlookFolder({ displayName: "Archive" }), false);
    assert.equal(shouldSkipOutlookFolder({ displayName: "Recruiters" }), false);
  });
});

describe("rankOutlookFolders", () => {
  it("puts sent, inbox, and archive ahead of custom folders and drops junk", () => {
    const ranked = rankOutlookFolders([
      { id: "junk", displayName: "Junk Email", wellKnownName: "junkemail" },
      { id: "custom", displayName: "Recruiters" },
      { id: "archive", displayName: "Archive", wellKnownName: "archive" },
      { id: "inbox", displayName: "Inbox", wellKnownName: "inbox" },
      { id: "sent", displayName: "Sent Items", wellKnownName: "sentitems" },
      { id: "drafts", displayName: "Drafts", wellKnownName: "drafts" },
      { id: "alpha", displayName: "Archive Clients" },
    ]);
    assert.deepEqual(
      ranked.map((folder) => folder.id),
      ["sent", "inbox", "archive", "alpha", "custom"]
    );
  });

  it("caps the folder list and dedupes ids", () => {
    const ranked = rankOutlookFolders(
      [
        { id: "sent", displayName: "Sent Items", wellKnownName: "sentitems" },
        { id: "sent", displayName: "Sent Items", wellKnownName: "sentitems" },
        { id: "a", displayName: "A" },
        { id: "b", displayName: "B" },
      ],
      2
    );
    assert.deepEqual(
      ranked.map((folder) => folder.id),
      ["sent", "a"]
    );
  });
});

describe("formatGraphAddress", () => {
  it("formats name and address the way contact matching expects", () => {
    assert.equal(
      formatGraphAddress({
        emailAddress: { name: "Ada Lovelace", address: "ada@example.com" },
      }),
      "Ada Lovelace <ada@example.com>"
    );
    assert.equal(
      formatGraphAddress({ emailAddress: { address: "ada@example.com" } }),
      "ada@example.com"
    );
    assert.equal(formatGraphAddress(null), "");
  });
});

describe("mapGraphMessage", () => {
  it("maps a Graph message and skips drafts", () => {
    const mapped = mapGraphMessage({
      id: "AAMk",
      subject: " Hello ",
      bodyPreview: "See you\nsoon",
      sentDateTime: "2026-03-01T15:04:05.000Z",
      webLink: "https://outlook.live.com/mail/id/AAMk",
      from: { emailAddress: { name: "Jason Kuperman", address: "jason.kuperman@outlook.com" } },
      toRecipients: [
        { emailAddress: { name: "Ada Lovelace", address: "ada@example.com" } },
      ],
      ccRecipients: [{ emailAddress: { address: "cc@example.com" } }],
    });
    assert.ok(mapped);
    assert.equal(mapped.from, "Jason Kuperman <jason.kuperman@outlook.com>");
    assert.equal(mapped.to, "Ada Lovelace <ada@example.com>");
    assert.equal(mapped.cc, "cc@example.com");
    assert.equal(mapped.subject, "Hello");
    assert.equal(mapped.snippet, "See you soon");
    assert.equal(mapped.date, "2026-03-01T15:04:05.000Z");
    assert.equal(
      mapGraphMessage({
        id: "draft",
        isDraft: true,
        sentDateTime: "2026-03-01T15:04:05.000Z",
        from: { emailAddress: { address: "jason.kuperman@outlook.com" } },
      }),
      null
    );
  });
});

describe("dedupeOutlookMessages", () => {
  it("keeps the first copy of a message id", () => {
    const first: OutlookMessage = {
      id: "1",
      from: "a@example.com",
      to: "",
      cc: "",
      subject: "first",
      date: "2026-03-01T00:00:00.000Z",
      snippet: "",
      webLink: null,
    };
    const second = { ...first, subject: "second" };
    assert.deepEqual(dedupeOutlookMessages([first, second]).map((m) => m.subject), ["first"]);
  });
});

describe("graphSinceTimestamp", () => {
  it("strips milliseconds for Graph filters", () => {
    assert.equal(
      graphSinceTimestamp("2026-03-01T15:04:05.123Z"),
      "2026-03-01T15:04:05Z"
    );
  });
});

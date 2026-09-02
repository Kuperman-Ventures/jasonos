import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  contactsNamedInTitle,
  matchCalendarEventToContacts,
  resolveBeeperPeer,
  resolveCalendarGuest,
} from "./calendar-matching";
import {
  createContactLookup,
  preferPersonName,
  type ContactLookupRow,
} from "./contact-lookup";

function contact(
  partial: Partial<ContactLookupRow> & Pick<ContactLookupRow, "id" | "name">
): ContactLookupRow {
  return {
    emails: [],
    phone: null,
    ...partial,
  };
}

const david = contact({
  id: "david",
  name: "David Newcomb",
  emails: ["davidnewcomb.executive@gmail.com"],
});

const jane = contact({
  id: "jane",
  name: "Jane Doe",
  emails: ["jane@acme.com"],
});

const lookup = createContactLookup([david, jane]);

describe("resolveCalendarGuest", () => {
  it("matches the contact email on the event", () => {
    const hit = resolveCalendarGuest(lookup, {
      email: "davidnewcomb.executive@gmail.com",
      name: "David Newcomb",
    });
    assert.equal(hit?.id, "david");
  });

  it("matches the display name when the guest email is missing or different", () => {
    assert.equal(
      resolveCalendarGuest(lookup, { email: "", name: "David Newcomb" })?.id,
      "david"
    );
    assert.equal(
      resolveCalendarGuest(lookup, {
        email: "david@somewhere-else.com",
        name: "David Newcomb",
      })?.id,
      "david"
    );
  });
});

describe("contactsNamedInTitle", () => {
  it("matches a first + last name in the event title", () => {
    const hits = contactsNamedInTitle("David Newcomb / catch up", lookup);
    assert.deepEqual(
      hits.map((row) => row.id),
      ["david"]
    );
  });

  it("does not match a first name alone", () => {
    assert.deepEqual(contactsNamedInTitle("David / team standup", lookup), []);
  });
});

describe("resolveBeeperPeer", () => {
  const dara = contact({
    id: "dara",
    name: "Dara Akbarian",
    emails: [],
    phone: null,
  });
  const daraLookup = createContactLookup([david, jane, dara]);

  it("matches the chat title when Beeper puts a phone in the peer name", () => {
    assert.equal(
      resolveBeeperPeer(daraLookup, {
        name: "+1 917-555-0100",
        phone: "+1 917-555-0100",
        chatTitle: "Dara Akbarian",
      })?.id,
      "dara"
    );
  });

  it("matches a first + last name inside a longer chat title", () => {
    assert.equal(
      resolveBeeperPeer(daraLookup, {
        name: null,
        chatTitle: "Dara Akbarian · iMessage",
      })?.id,
      "dara"
    );
  });

  it("prefers a person name over a phone label", () => {
    assert.equal(preferPersonName("+1 917-555-0100", "Dara Akbarian"), "Dara Akbarian");
  });
});

describe("matchCalendarEventToContacts", () => {
  it("attaches from title when nobody is on the guest list", () => {
    const result = matchCalendarEventToContacts({
      title: "Catch-up with David Newcomb",
      guests: [],
      lookup,
    });
    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0]?.contact.id, "david");
  });

  it("does not duplicate a guest who is also named in the title", () => {
    const result = matchCalendarEventToContacts({
      title: "David Newcomb",
      guests: [{ email: "davidnewcomb.executive@gmail.com", name: "David Newcomb" }],
      lookup,
    });
    assert.equal(result.matches.length, 1);
    assert.equal(result.unmatchedGuests.length, 0);
  });

  it("keeps unmatched guests for Suggested staging", () => {
    const result = matchCalendarEventToContacts({
      title: "Intro",
      guests: [{ email: "pat@new.co", name: "Pat New" }],
      lookup,
    });
    assert.equal(result.matches.length, 0);
    assert.equal(result.unmatchedGuests[0]?.email, "pat@new.co");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  beeperCandidateIdentity,
  beeperSightingEmail,
  canonicalEmail,
  createContactLookup,
  findNameMatch,
  hasExactEmailMatch,
  isAlreadyAContact,
  isBeeperPlaceholderEmail,
  looksLikePersonName,
  namesLookLikeSamePerson,
  type ContactLookupRow,
} from "./contact-lookup.ts";

function contact(
  partial: Partial<ContactLookupRow> & Pick<ContactLookupRow, "id" | "name">
): ContactLookupRow {
  return {
    emails: [],
    phone: null,
    ...partial,
  };
}

const ross = contact({
  id: "ross",
  name: "Ross Holtzer",
  emails: [
    "ross.holtzer@gmail.com",
    "ross.holtzer@outfrontmedia.com",
    "ross.holtzer@outfront.com",
  ],
});

const sethTypo = contact({
  id: "seth",
  name: "Seth Dellaire",
  emails: [],
});

describe("hasExactEmailMatch", () => {
  it("matches the same address ignoring case", () => {
    assert.equal(
      hasExactEmailMatch(
        "Ross.Holtzer@OutfrontMedia.com",
        ross.emails
      ),
      true
    );
  });

  it("matches an address pulled out of a Name <email> header", () => {
    assert.equal(
      hasExactEmailMatch("Ross Holtzer <ross.holtzer@outfront.com>", ross.emails),
      true
    );
  });

  it("matches plus-tagged copies of an address already on file", () => {
    assert.equal(
      hasExactEmailMatch("ross.holtzer+news@gmail.com", ross.emails),
      true
    );
  });

  it("does not match a different address for the same person", () => {
    assert.equal(
      hasExactEmailMatch("ross.holtzer@somewhere-else.com", ross.emails),
      false
    );
  });
});

describe("Suggested Contacts exact-email exclusion", () => {
  const lookup = createContactLookup([ross, sethTypo]);

  it("does not suggest someone whose email is already on a contact", () => {
    assert.equal(
      isAlreadyAContact(
        { email: "ross.holtzer@outfrontmedia.com", name: "Ross Holtzer" },
        lookup
      ),
      true
    );
    assert.ok(lookup.resolveEmail("ross.holtzer@outfrontmedia.com"));
  });

  it("does not suggest when the candidate name differs but the email is the same", () => {
    assert.equal(
      isAlreadyAContact(
        { email: "ross.holtzer@outfront.com", name: "R. Holtzer (Outfront)" },
        lookup
      ),
      true
    );
  });

  it("still suggests a close name when no email is on file", () => {
    // Contact is "Seth Dellaire" with no email; mail is "Seth Dallaire".
    assert.equal(lookup.resolveEmail("seth.dallaire@walmart.com"), undefined);
    assert.equal(
      isAlreadyAContact(
        { email: "seth.dallaire@walmart.com", name: "Seth Dallaire" },
        lookup
      ),
      false
    );
  });

  it("still suggests an exact name when only the name matches", () => {
    const jane = contact({ id: "jane", name: "Jane Doe", emails: [] });
    const namesOnly = createContactLookup([jane]);
    assert.equal(
      isAlreadyAContact({ email: "jane@acme.com", name: "Jane Doe" }, namesOnly),
      false
    );
  });

  it("canonicalEmail lowercases and strips plus-tags", () => {
    assert.equal(
      canonicalEmail("Jane+board@Acme.com"),
      "jane@acme.com"
    );
  });
});

describe("findNameMatch for Suggested merge", () => {
  const jane = contact({ id: "jane", name: "Jane Doe", emails: [] });
  const lookup = createContactLookup([ross, sethTypo, jane]);

  it("offers merge on an exact name with a new email", () => {
    const match = findNameMatch(
      { email: "jane@acme.com", name: "Jane Doe" },
      lookup
    );
    assert.deepEqual(match, { id: "jane", name: "Jane Doe", kind: "exact" });
  });

  it("offers merge on a one-letter last-name typo", () => {
    const match = findNameMatch(
      { email: "seth.dallaire@walmart.com", name: "Seth Dallaire" },
      lookup
    );
    assert.deepEqual(match, {
      id: "seth",
      name: "Seth Dellaire",
      kind: "close",
    });
  });

  it("does not offer merge when the email is already on the contact", () => {
    assert.equal(
      findNameMatch(
        { email: "ross.holtzer@outfront.com", name: "Ross Holtzer" },
        lookup
      ),
      null
    );
  });

  it("treats the Beeper name as the record, with phone as extra", () => {
    assert.equal(looksLikePersonName("David Newcom"), true);
    assert.equal(looksLikePersonName("Lenora"), true);
    assert.equal(looksLikePersonName("+1 862-400-1167"), false);
    assert.equal(looksLikePersonName("86197"), false);
    assert.equal(looksLikePersonName("keannabo1inalal"), false);

    assert.deepEqual(beeperCandidateIdentity({ name: "David Newcom" }), {
      email: "david.newcom@beeper.invalid",
      name: "David Newcom",
      phone: null,
      realEmail: null,
    });
    assert.deepEqual(
      beeperCandidateIdentity({
        name: "Jeffrey Wu",
        phone: "555-111-2222",
        email: "jeff@wu.com",
      }),
      {
        email: "jeff@wu.com",
        name: "Jeffrey Wu",
        phone: "5551112222",
        realEmail: "jeff@wu.com",
      }
    );
    assert.equal(
      beeperCandidateIdentity({ phone: "+1 862-400-1167", chatTitle: "+1 862-400-1167" }),
      null
    );
    assert.equal(beeperSightingEmail({ name: "David Newcom" }), "david.newcom@beeper.invalid");
    assert.equal(isBeeperPlaceholderEmail("david.newcom@beeper.invalid"), true);
    assert.equal(isBeeperPlaceholderEmail("jeff@wu.com"), false);
  });

  it("does not treat Hall / Hill as the same last name", () => {
    assert.equal(namesLookLikeSamePerson("Chris Hall", "Chris Hill"), false);
    const chris = createContactLookup([
      contact({ id: "hall", name: "Chris Hall", emails: [] }),
    ]);
    assert.equal(
      findNameMatch({ email: "chris@hill.co", name: "Chris Hill" }, chris),
      null
    );
  });
});

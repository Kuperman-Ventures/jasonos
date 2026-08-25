import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalEmail,
  createContactLookup,
  hasExactEmailMatch,
  isAlreadyAContact,
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

  it("canonicalEmail lowercases and strips plus-tags", () => {
    assert.equal(
      canonicalEmail("Jane+board@Acme.com"),
      "jane@acme.com"
    );
  });
});

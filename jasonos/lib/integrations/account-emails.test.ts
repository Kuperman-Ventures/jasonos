import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GMAIL_ACCOUNT_EMAIL,
  isPersonalGmailAccount,
} from "./account-emails.ts";

describe("personal Gmail address", () => {
  it("uses jskuperman@gmail.com and rejects the unused lookalike", () => {
    assert.equal(GMAIL_ACCOUNT_EMAIL, "jskuperman@gmail.com");
    assert.equal(isPersonalGmailAccount(" jskuperman@gmail.com "), true);
    assert.equal(isPersonalGmailAccount("jasonkuperman@gmail.com"), false);
  });
});

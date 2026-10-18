import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isJasonosEmail, loginErrorMessage, normalizeEmail } from "./allowlist.ts";

describe("JasonOS email allowlist", () => {
  it("accepts Jason's Advisors, Outlook, and the confirmed Gmail alias", () => {
    assert.equal(isJasonosEmail("jason@kupermanadvisors.com"), true);
    assert.equal(isJasonosEmail(" jskuperman@gmail.com "), true);
    assert.equal(isJasonosEmail("jason.kuperman@outlook.com"), true);
    assert.equal(isJasonosEmail("jasonkuperman@gmail.com"), false);
  });

  it("rejects College household accounts", () => {
    assert.equal(isJasonosEmail("kyle@example.com"), false);
    assert.equal(isJasonosEmail("kat@example.com"), false);
    assert.equal(isJasonosEmail(""), false);
    assert.equal(isJasonosEmail(null), false);
  });

  it("normalizes email case and space", () => {
    assert.equal(normalizeEmail("  Jason@KupermanAdvisors.com "), "jason@kupermanadvisors.com");
  });

  it("maps login error codes", () => {
    assert.match(loginErrorMessage("not_jason") ?? "", /cannot open JasonOS/);
    assert.match(loginErrorMessage("passkey_required") ?? "", /Face ID \/ Touch ID/);
    assert.match(loginErrorMessage("enroll_required") ?? "", /unlock with it/);
    assert.equal(loginErrorMessage("nope"), null);
  });
});

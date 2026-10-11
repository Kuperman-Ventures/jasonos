import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  preferPlatformCreationOptions,
  preferPlatformRequestOptions,
} from "./passkeys-browser.ts";

describe("platform passkey option overrides", () => {
  it("forces this-device authenticators for registration", () => {
    const next = preferPlatformCreationOptions({
      challenge: "abc",
      rp: { name: "JasonOS", id: "jasonos.vercel.app" },
      user: { id: "uid", name: "jason", displayName: "Jason" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      hints: ["security-key"],
      attestation: "direct",
      authenticatorSelection: {
        authenticatorAttachment: "cross-platform",
        residentKey: "discouraged",
        requireResidentKey: false,
        userVerification: "preferred",
      },
    });

    assert.deepEqual(next.hints, ["client-device"]);
    assert.equal(next.attestation, "none");
    assert.equal(next.authenticatorSelection?.authenticatorAttachment, "platform");
    assert.equal(next.authenticatorSelection?.residentKey, "preferred");
    assert.equal(next.authenticatorSelection?.userVerification, "preferred");
  });

  it("forces this-device hints for unlock", () => {
    const next = preferPlatformRequestOptions({
      challenge: "abc",
      hints: ["security-key"],
    });
    assert.deepEqual(next.hints, ["client-device"]);
    assert.equal(next.userVerification, "required");
  });
});

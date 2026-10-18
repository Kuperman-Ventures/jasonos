import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  passkeyAlreadyOnThisDevice,
  passkeyErrorMessage,
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

describe("passkey already on this device", () => {
  const already = new Error(
    "The user attempted to register an authenticator that contains one of the credentials already registered with the relying party."
  );
  already.name = "InvalidStateError";

  it("recognizes the browser already-registered error", () => {
    assert.equal(passkeyAlreadyOnThisDevice(already), true);
    assert.match(passkeyErrorMessage(already), /already has Face ID or Touch ID/);
    assert.doesNotMatch(passkeyErrorMessage(already), /relying party/);
  });

  it("leaves other failures alone", () => {
    const cancelled = new Error("The operation either timed out or was not allowed.");
    cancelled.name = "NotAllowedError";
    assert.equal(passkeyAlreadyOnThisDevice(cancelled), false);
    assert.match(passkeyErrorMessage(cancelled), /cancelled/);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  contactPhotoObjectPath,
  imageTypeFromBytes,
  isFetchablePhotoUrl,
  isStoredContactPhotoUrl,
  photoSaveAction,
  publicContactPhotoUrl,
  remotePhotoFailureIsExpired,
} from "./contact-photo-cache.ts";

const CONTACT_ID = "3f1c0c3e-6a1a-4e0a-9c1a-2b3c4d5e6f70";

describe("imageTypeFromBytes", () => {
  it("recognizes jpeg, png, webp, and gif", () => {
    assert.equal(imageTypeFromBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))?.ext, "jpg");
    assert.equal(
      imageTypeFromBytes(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )?.mime,
      "image/png"
    );
    const webp = new Uint8Array(12);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    assert.equal(imageTypeFromBytes(webp)?.ext, "webp");
    assert.equal(
      imageTypeFromBytes(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))?.ext,
      "gif"
    );
    assert.equal(imageTypeFromBytes(Uint8Array.from([0x3c, 0x68, 0x74, 0x6d, 0x6c])), null);
  });
});

describe("contact photo addresses", () => {
  it("builds a stable file name and public address", () => {
    assert.equal(contactPhotoObjectPath(CONTACT_ID, "jpg"), `${CONTACT_ID}.jpg`);
    assert.equal(contactPhotoObjectPath("not-an-id", "jpg"), null);
    assert.equal(contactPhotoObjectPath(CONTACT_ID, "svg"), null);
    assert.equal(
      publicContactPhotoUrl("https://example.supabase.co/", `${CONTACT_ID}.jpg`, "171000"),
      `https://example.supabase.co/storage/v1/object/public/contact-photos/${CONTACT_ID}.jpg?v=171000`
    );
  });

  it("knows which addresses are already the saved copy", () => {
    assert.equal(
      isStoredContactPhotoUrl(
        `https://example.supabase.co/storage/v1/object/public/contact-photos/${CONTACT_ID}.jpg?v=1`
      ),
      true
    );
    assert.equal(
      isStoredContactPhotoUrl("https://media.licdn.com/dms/image/v2/abc.jpg?e=1"),
      false
    );
    assert.equal(isStoredContactPhotoUrl("not a url"), false);
  });

  it("rejects photo links that are not public https hosts", () => {
    assert.equal(isFetchablePhotoUrl("https://media.licdn.com/dms/image/a.jpg"), true);
    assert.equal(isFetchablePhotoUrl("http://media.licdn.com/a.jpg"), false);
    assert.equal(isFetchablePhotoUrl("https://127.0.0.1/a.jpg"), false);
    assert.equal(isFetchablePhotoUrl("https://localhost/a.jpg"), false);
    assert.equal(isFetchablePhotoUrl("https://user:pass@cdn.example.com/a.jpg"), false);
  });
});

describe("photoSaveAction", () => {
  const stored = `https://example.supabase.co/storage/v1/object/public/contact-photos/${CONTACT_ID}.jpg`;

  it("keeps a saved copy and caches a remote link", () => {
    assert.equal(
      photoSaveAction({ photoUrl: stored, photoSource: "stored" }),
      "keep"
    );
    assert.equal(
      photoSaveAction({
        photoUrl: "https://media.licdn.com/a.jpg",
        photoSource: "leaddelta",
      }),
      "cache-remote"
    );
    assert.equal(
      photoSaveAction({ photoUrl: null, photoSource: null }),
      "fetch-source"
    );
  });

  it("waits before retrying a link that already failed", () => {
    const now = Date.parse("2026-10-26T15:00:00Z");
    assert.equal(
      photoSaveAction({
        photoUrl: "https://media.licdn.com/a.jpg",
        photoSource: "leaddelta-unreadable",
        photoUpdatedAt: "2026-10-26T14:00:00Z",
        now,
      }),
      "keep"
    );
    assert.equal(
      photoSaveAction({
        photoUrl: "https://media.licdn.com/a.jpg",
        photoSource: "leaddelta-unreadable",
        photoUpdatedAt: "2026-10-25T14:00:00Z",
        now,
      }),
      "cache-remote"
    );
  });

  it("fetches again when forced, including over a saved copy", () => {
    assert.equal(
      photoSaveAction({ force: true, photoUrl: stored, photoSource: "stored" }),
      "fetch-source"
    );
  });
});

describe("remotePhotoFailureIsExpired", () => {
  it("treats gone and forbidden links as expired", () => {
    assert.equal(remotePhotoFailureIsExpired(403), true);
    assert.equal(remotePhotoFailureIsExpired(404), true);
    assert.equal(remotePhotoFailureIsExpired(500), false);
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import { avatarExtension, memberInitials, publicAvatarUrl } from "./member-avatars";

test("memberInitials uses first letters", () => {
  assert.equal(memberInitials("Jason"), "JA");
  assert.equal(memberInitials("Kat Kuperman"), "KK");
  assert.equal(memberInitials("  "), "?");
});

test("avatarExtension maps allowed mime types", () => {
  assert.equal(avatarExtension("image/jpeg"), "jpg");
  assert.equal(avatarExtension("image/png"), "png");
  assert.equal(avatarExtension("image/webp"), "webp");
  assert.equal(avatarExtension("text/plain"), null);
});

test("publicAvatarUrl builds a public storage URL", () => {
  const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  assert.equal(
    publicAvatarUrl("jason/avatar.jpg"),
    "https://example.supabase.co/storage/v1/object/public/college-avatars/jason/avatar.jpg",
  );
  assert.equal(publicAvatarUrl(null), null);
  process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
});

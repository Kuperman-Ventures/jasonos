import assert from "node:assert/strict";
import test from "node:test";
import {
  avatarExtension,
  memberInitials,
  oauthAvatarFromMetadata,
  publicAvatarUrl,
  resolveMemberAvatarUrl,
} from "./member-avatars";

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

test("resolveMemberAvatarUrl prefers upload over Google photo", () => {
  const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  assert.equal(
    resolveMemberAvatarUrl("kyle/avatar.png", "https://lh3.googleusercontent.com/a/kyle"),
    "https://example.supabase.co/storage/v1/object/public/college-avatars/kyle/avatar.png",
  );
  assert.equal(
    resolveMemberAvatarUrl(null, "https://lh3.googleusercontent.com/a/kyle"),
    "https://lh3.googleusercontent.com/a/kyle",
  );
  assert.equal(resolveMemberAvatarUrl(null, null), null);
  process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
});

test("oauthAvatarFromMetadata reads Google picture fields", () => {
  assert.equal(
    oauthAvatarFromMetadata({
      avatar_url: "https://lh3.googleusercontent.com/a/from-avatar-url",
      picture: "https://lh3.googleusercontent.com/a/from-picture",
    }),
    "https://lh3.googleusercontent.com/a/from-avatar-url",
  );
  assert.equal(
    oauthAvatarFromMetadata({ picture: "https://lh3.googleusercontent.com/a/from-picture" }),
    "https://lh3.googleusercontent.com/a/from-picture",
  );
  assert.equal(oauthAvatarFromMetadata({ picture: "not-a-url" }), null);
  assert.equal(oauthAvatarFromMetadata(null), null);
});

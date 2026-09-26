-- Google (or other OAuth) profile photo URL as fallback when no uploaded avatar.

alter table college.members
  add column if not exists oauth_avatar_url text;

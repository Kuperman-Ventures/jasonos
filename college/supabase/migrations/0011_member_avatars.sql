-- Profile pictures for household members (used on attribution badges).
alter table college.members
  add column if not exists avatar_path text;

-- Public bucket so badge images can load without signed URLs.
-- Uploads go through the Next.js API with the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'college-avatars',
  'college-avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read college avatars" on storage.objects;
create policy "Public read college avatars"
  on storage.objects
  for select
  using (bucket_id = 'college-avatars');

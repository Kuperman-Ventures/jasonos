-- Keep a copy of each contact profile photo in Storage.
-- LinkedIn image links expire, so the app was showing a broken picture
-- even after the photo had already loaded once.
-- photo_url stays the address the app displays. Once a picture is saved,
-- that address points at the contact-photos bucket instead of LinkedIn.
-- photo_storage_path is the file name inside that bucket.

set search_path = jasonos, public;

alter table jasonos.contacts
  add column if not exists photo_storage_path text;

comment on column jasonos.contacts.photo_url is
  'Profile image the app displays. Once saved, this is the JasonOS Storage address, not an expiring LinkedIn link.';
comment on column jasonos.contacts.photo_source is
  'stored = saved in JasonOS. leaddelta = remote link not saved yet. leaddelta-unreadable = the remote link failed and should not be retried immediately.';
comment on column jasonos.contacts.photo_storage_path is
  'File name inside the contact-photos bucket when the picture has been saved.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contact-photos',
  'contact-photos',
  true,
  1572864,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read contact photos" on storage.objects;
create policy "Public read contact photos"
  on storage.objects
  for select
  using (bucket_id = 'contact-photos');

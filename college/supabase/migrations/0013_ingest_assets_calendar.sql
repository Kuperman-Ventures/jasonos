-- Ingest assets (PDF + images) and calendar events from Ingest.

alter table college.app_state
  add column if not exists calendar_events jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'college-ingest',
  'college-ingest',
  true,
  26214400,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read college ingest" on storage.objects;
create policy "Public read college ingest"
  on storage.objects
  for select
  using (bucket_id = 'college-ingest');

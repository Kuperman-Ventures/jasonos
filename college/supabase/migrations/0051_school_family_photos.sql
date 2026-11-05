-- Family visit photos for each school (shared household library).

create table if not exists college.school_photos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  school_id text not null references college.schools (id) on delete cascade,
  uploaded_by_id text not null,
  uploaded_by_name text not null,
  storage_path text not null unique,
  caption text not null default '',
  visit_date date,
  starred boolean not null default false,
  mime_type text not null,
  byte_size integer not null default 0
);

create index if not exists school_photos_school_created_idx
  on college.school_photos (school_id, created_at desc);

comment on table college.school_photos is
  'Family-uploaded campus visit photos. Shared across the household; files live in college-school-photos.';

alter table college.school_photos enable row level security;
revoke all on table college.school_photos from public, anon, authenticated;
grant all on table college.school_photos to service_role;

-- Public bucket so thumbs/full images load without signed URLs.
-- Uploads go through the Next.js API with the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'college-school-photos',
  'college-school-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read college school photos" on storage.objects;
create policy "Public read college school photos"
  on storage.objects
  for select
  using (bucket_id = 'college-school-photos');

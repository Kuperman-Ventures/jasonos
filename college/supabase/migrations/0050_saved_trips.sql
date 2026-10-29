-- Named Visit Planning trips shared across the household.

create table if not exists college.saved_trips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  school_ids text[] not null default '{}',
  school_names text[] not null default '{}',
  start_address text not null default '',
  end_address text not null default '',
  created_by_id text not null,
  created_by_name text not null
);

create index if not exists saved_trips_updated_at_idx
  on college.saved_trips (updated_at desc);

comment on table college.saved_trips is
  'Named Visit Planning routes (school order + start/end). Shared household library.';

alter table college.saved_trips enable row level security;
revoke all on table college.saved_trips from public, anon, authenticated;
grant all on table college.saved_trips to service_role;

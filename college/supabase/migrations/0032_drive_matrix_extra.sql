-- Writable drive pairs and travel points for schools added after the base matrix.
create table if not exists college.travel_points_extra (
  id text primary key,
  type text not null check (type in ('home', 'school', 'airport')),
  name text not null,
  address text not null,
  regions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists college.drive_pairs_extra (
  from_id text not null,
  to_id text not null,
  minutes integer,
  miles integer,
  calculated_date text not null default '',
  primary key (from_id, to_id)
);

comment on table college.travel_points_extra is
  'Travel points added at runtime (new schools). Base points stay in data/travel-points.json.';
comment on table college.drive_pairs_extra is
  'Drive legs involving points added at runtime. Base pairs stay in data/drive-matrix.json.';

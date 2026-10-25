-- Dark Matter Travel Tracker: trips, travelers, itinerary.
-- Public family tool at /projects/dark-matter-travel-tracker (and /dark-matter).
-- Outside JasonOS login. Chrome is hidden. Service-role only.
-- Same isolation as Ski Tracker: the JasonOS server reads and writes; anon
-- and authenticated roles have no Data API access to these tables.

set search_path = jasonos, public;

create table if not exists jasonos.dark_matter_trips (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  destination text not null default '',
  start_date date,
  end_date date,
  status text not null default 'planning'
    check (status in ('idea', 'planning', 'booked', 'happening', 'done')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dark_matter_trips_dates_check check (
    start_date is null or end_date is null or end_date >= start_date
  )
);

create table if not exists jasonos.dark_matter_travelers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references jasonos.dark_matter_trips(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists dark_matter_travelers_trip_idx
  on jasonos.dark_matter_travelers (trip_id, created_at);

create table if not exists jasonos.dark_matter_itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references jasonos.dark_matter_trips(id) on delete cascade,
  occurs_on date,
  start_time text,
  kind text not null default 'activity'
    check (kind in ('flight', 'stay', 'transit', 'activity', 'meal', 'note')),
  title text not null,
  location text not null default '',
  confirmation text not null default '',
  notes text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dark_matter_itinerary_trip_day_idx
  on jasonos.dark_matter_itinerary_items (trip_id, occurs_on, sort_order, created_at);

comment on table jasonos.dark_matter_trips is
  'Dark Matter Travel Tracker trips. Public UI; service-role only.';

alter table jasonos.dark_matter_trips enable row level security;
alter table jasonos.dark_matter_travelers enable row level security;
alter table jasonos.dark_matter_itinerary_items enable row level security;

revoke all on table jasonos.dark_matter_trips from anon, authenticated;
revoke all on table jasonos.dark_matter_travelers from anon, authenticated;
revoke all on table jasonos.dark_matter_itinerary_items from anon, authenticated;

grant all on table jasonos.dark_matter_trips to service_role;
grant all on table jasonos.dark_matter_travelers to service_role;
grant all on table jasonos.dark_matter_itinerary_items to service_role;

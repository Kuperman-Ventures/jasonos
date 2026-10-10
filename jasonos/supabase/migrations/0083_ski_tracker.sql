-- Ski Tracker: mountain catalog, Open-Meteo weather cache, optional weekend
-- AI summaries. Service-role only. The checked-in resorts.json catalog is the
-- Phase 0 seed; this is the live store once ingest is wired.
--
-- Data flow (from How the Ski Tracker Works):
--   sources → ingest → process → analysis → UI
-- Stored between uses: resorts (drive time + source links).
-- Weather is fetched on open; snapshots are cached here so we do not
-- hammer Open-Meteo. Rankings are not computed in this migration.

set search_path = jasonos, public;

create table if not exists jasonos.ski_resorts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  pass text not null default 'independent'
    check (pass in ('epic', 'independent')),
  drive_minutes integer,
  overnight boolean not null default false,
  two_hour boolean not null default false,
  christmas_open boolean not null default false,
  latitude double precision,
  longitude double precision,
  source_links jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists jasonos.ski_weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  resort_id uuid not null references jasonos.ski_resorts(id) on delete cascade,
  fetched_at timestamptz not null default now(),
  source text not null default 'open-meteo',
  payload jsonb not null default '{}'::jsonb,
  new_snow_in numeric,
  weekend_snow_in numeric,
  temp_f numeric
);

create index if not exists ski_weather_snapshots_resort_fetched_idx
  on jasonos.ski_weather_snapshots (resort_id, fetched_at desc);

create table if not exists jasonos.ski_weekend_summaries (
  id uuid primary key default gen_random_uuid(),
  weekend_start date not null unique,
  summary text not null,
  model text,
  created_at timestamptz not null default now()
);

alter table jasonos.ski_resorts enable row level security;
alter table jasonos.ski_weather_snapshots enable row level security;
alter table jasonos.ski_weekend_summaries enable row level security;

-- No anon/authenticated policies: only the service role (JasonOS server)
-- reads and writes. Service role bypasses RLS.

-- Last recorded call / test / link check per Data Sources registry entry.
create table if not exists college.data_source_checks (
  source_id text primary key,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  last_ms integer,
  broken_links jsonb not null default '[]'::jsonb,
  blocked_links jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table college.data_source_checks is
  'One row per Data Sources registry id (lib/data-sources.ts). Written by real calls, Test connection, and Check all.';
comment on column college.data_source_checks.broken_links is
  'Link-out URLs that returned 404/410/5xx or failed DNS: [{schoolId, schoolName, url, status}].';
comment on column college.data_source_checks.blocked_links is
  'Link-out URLs that refused the checker (401/403/429 or bot walls) but likely work in a browser.';

alter table college.data_source_checks enable row level security;
revoke all on table college.data_source_checks from public, anon, authenticated;
grant all on table college.data_source_checks to service_role;

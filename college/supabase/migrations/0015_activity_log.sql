-- Append-only household activity log (who did what on Kyle College).

create table if not exists college.activity_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id text not null,
  actor_name text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  detail jsonb not null default '{}'::jsonb
);

create index if not exists activity_log_created_at_idx
  on college.activity_log (created_at desc);

revoke all on table college.activity_log from public, anon, authenticated;
grant all on table college.activity_log to service_role;

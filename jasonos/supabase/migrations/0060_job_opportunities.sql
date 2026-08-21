-- 0060_job_opportunities.sql
-- ---------------------------------------------------------------------------
-- Job Alerts harvested directly from a Gmail folder (not from morning-brief
-- markdown). One row per listing. Re-runs are idempotent via fingerprint.
-- Service-role only (same posture as job_alert_keywords).
-- ---------------------------------------------------------------------------

create table if not exists jasonos.job_opportunities (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null,
  gmail_thread_id text not null,
  gmail_message_id text not null,
  account_email text not null,
  source_label text,
  from_email text,
  from_name text,
  subject text,
  title text not null,
  company text,
  compensation text,
  job_url text,
  gmail_url text not null,
  snippet text,
  received_at timestamptz not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint job_opportunities_fingerprint_uidx unique (fingerprint)
);

create index if not exists job_opportunities_received_idx
  on jasonos.job_opportunities (received_at desc);

create index if not exists job_opportunities_message_idx
  on jasonos.job_opportunities (gmail_message_id);

alter table jasonos.job_opportunities enable row level security;

-- Message ids already opened so empty/unparseable alerts are not refetched.
create table if not exists jasonos.job_alert_seen_messages (
  message_id text primary key,
  thread_id text,
  account_email text not null,
  received_at timestamptz,
  listings_found integer not null default 0,
  seen_at timestamptz not null default now()
);

alter table jasonos.job_alert_seen_messages enable row level security;

create table if not exists jasonos.job_alert_harvest_state (
  id text primary key default 'default',
  label_name text,
  label_id text,
  account_email text,
  last_run_at timestamptz,
  last_result jsonb not null default '{}'::jsonb,
  error text
);

insert into jasonos.job_alert_harvest_state (id)
values ('default')
on conflict (id) do nothing;

alter table jasonos.job_alert_harvest_state enable row level security;

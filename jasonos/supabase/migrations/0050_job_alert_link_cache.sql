-- 0050_job_alert_link_cache.sql
-- ---------------------------------------------------------------------------
-- Cache resolved deep links for Job Alerts opportunities. Morning briefs often
-- only include a Gmail permalink; we open the alert once via the Gmail API,
-- extract the real job-listing URL (LinkedIn / Indeed / ATS), and store it so
-- subsequent page loads don't re-hit Gmail.
-- ---------------------------------------------------------------------------

create table if not exists jasonos.job_alert_link_cache (
  source_id text primary key,
  thread_id text,
  gmail_url text not null,
  job_url text,
  resolved_at timestamptz not null default now()
);

create index if not exists job_alert_link_cache_resolved_at_idx
  on jasonos.job_alert_link_cache (resolved_at desc);

alter table jasonos.job_alert_link_cache enable row level security;

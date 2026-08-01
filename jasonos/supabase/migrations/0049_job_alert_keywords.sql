-- 0049_job_alert_keywords.sql
-- ---------------------------------------------------------------------------
-- Editable keyword capsules shown on Job Alerts. Used to highlight which
-- harvested opportunities match roles Jason is tracking. Independent of NYUI
-- work_searches (those remain application logs).
-- ---------------------------------------------------------------------------

create table if not exists jasonos.job_alert_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  created_at timestamptz not null default now(),
  constraint job_alert_keywords_keyword_nonempty check (length(trim(keyword)) > 0)
);

create unique index if not exists job_alert_keywords_keyword_lower_uidx
  on jasonos.job_alert_keywords (lower(trim(keyword)));

alter table jasonos.job_alert_keywords enable row level security;

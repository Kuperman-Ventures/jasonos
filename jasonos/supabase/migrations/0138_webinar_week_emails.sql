-- Monday morning webinar week summary emails.
-- One row per week_start (Monday, America/New_York). Service-role only.

set search_path = jasonos, public;

create table if not exists jasonos.webinar_week_emails (
  week_start date primary key,
  subject text not null,
  to_email text not null,
  gmail_message_id text,
  session_count int not null default 0,
  takeaway_count int not null default 0,
  action_count int not null default 0,
  topic_count int not null default 0,
  sent_at timestamptz not null default now()
);

comment on table jasonos.webinar_week_emails is
  'Idempotent send log for the Monday morning HTML webinar week summary.';

alter table jasonos.webinar_week_emails enable row level security;

revoke all on table jasonos.webinar_week_emails from anon, authenticated;
grant all on table jasonos.webinar_week_emails to service_role;

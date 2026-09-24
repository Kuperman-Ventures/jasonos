-- Sent mail from jason@kupermanadvisors.com that Sync stages for a
-- follow-up decision. One row per Gmail thread. Jason picks 1 / 3 / 5 /
-- custom days (or no follow-up). Home shows the row once that day arrives.
-- Service-role only.

create table if not exists jasonos.sent_email_followups (
  id uuid primary key default gen_random_uuid(),
  account_email text not null,
  gmail_thread_id text not null,
  gmail_message_id text not null,
  subject text,
  recipients jsonb not null default '[]'::jsonb,
  to_line text,
  sent_at timestamptz not null,
  snippet text,
  status text not null default 'new'
    check (status in ('new', 'scheduled', 'done', 'dismissed')),
  follow_up_days integer,
  follow_up_due date,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_email, gmail_thread_id)
);

create index if not exists sent_email_followups_status_due_idx
  on jasonos.sent_email_followups (status, follow_up_due);

alter table jasonos.sent_email_followups enable row level security;

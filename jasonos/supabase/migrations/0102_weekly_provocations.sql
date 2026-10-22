-- Weekly Provocation briefs filed by the standard mail Sync.
-- Service-role only. JasonOS reads and writes these from server code.

create table if not exists jasonos.weekly_provocations (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('gmail', 'outlook')),
  account_email text not null default '',
  external_id text not null,
  thread_id text,
  rfc822_message_id text,
  from_name text not null default '',
  from_email text not null default '',
  subject text not null default '',
  received_at timestamptz,
  thread_url text,
  body_text text not null default '',
  tldr text,
  questions jsonb not null default '[]'::jsonb,
  status text not null default 'detected'
    check (status in ('detected', 'researching', 'ready', 'failed')),
  error text,
  researched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, account_email, external_id)
);

comment on table jasonos.weekly_provocations is
  'Weekly Provocation emails from Rover or Will Duffy, plus a brief, the questions, and sourced background.';

create unique index if not exists weekly_provocations_rfc822_idx
  on jasonos.weekly_provocations (rfc822_message_id)
  where rfc822_message_id is not null and length(rfc822_message_id) > 0;

create index if not exists weekly_provocations_received_idx
  on jasonos.weekly_provocations (received_at desc nulls last);

alter table jasonos.weekly_provocations enable row level security;
revoke all on table jasonos.weekly_provocations from anon, authenticated;

-- 0057_inbox_dispatches.sql
-- ---------------------------------------------------------------------------
-- Published Inbox Dispatch for the JasonOS home page.
--
-- The weekday morning triage agent (which reads Gmail AND creates real reply
-- drafts) publishes one row per day here; the home card reads today's Eastern
-- date, falling back to the most recent row. The in-app engine in
-- lib/integrations/inbox-triage.ts stays as the live fallback for days the
-- publisher didn't run and for the card's Refresh button.
--
-- `payload` is an InboxDispatch object (see lib/integrations/inbox-triage.ts).
-- Lives in public so an external publisher can use the default schema, same
-- arrangement as public.morning_briefs (0046).
-- ---------------------------------------------------------------------------

create table if not exists public.inbox_dispatches (
  id uuid primary key default gen_random_uuid(),
  dispatch_date date not null unique,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inbox_dispatches_dispatch_date_desc_idx
  on public.inbox_dispatches (dispatch_date desc);

alter table public.inbox_dispatches enable row level security;

-- No anon/authenticated policies: only the service role (JasonOS server +
-- the Claude publisher) can read/write. Service role bypasses RLS.

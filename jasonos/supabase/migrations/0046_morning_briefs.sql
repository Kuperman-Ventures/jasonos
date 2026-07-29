-- 0046_morning_briefs.sql
-- ---------------------------------------------------------------------------
-- Published weekday morning brief for the JasonOS home page.
-- Claude (or a scheduled job) inserts one row per day; the home card reads
-- today's Eastern date, falling back to the most recent row.
-- Lives in public so an external publisher can use the default schema.
-- ---------------------------------------------------------------------------

create table if not exists public.morning_briefs (
  id uuid primary key default gen_random_uuid(),
  brief_date date not null unique,
  content_md text not null,
  created_at timestamptz not null default now()
);

create index if not exists morning_briefs_brief_date_desc_idx
  on public.morning_briefs (brief_date desc);

alter table public.morning_briefs enable row level security;

-- No anon/authenticated policies: only the service role (JasonOS server +
-- Claude publisher) can read/write. Service role bypasses RLS.

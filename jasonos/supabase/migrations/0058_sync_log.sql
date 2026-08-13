-- 0058_sync_log.sql
-- ---------------------------------------------------------------------------
-- Append-only log of every Gmail / Calendar / Beeper / Suggested sync.
-- jasonos.outreach_sync_state still holds the latest run per source; this
-- table keeps the full history for Settings → Sync Log.
-- Service-role only.
-- ---------------------------------------------------------------------------

create table if not exists jasonos.sync_log (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  source text not null,
  ok boolean not null default true,
  unavailable boolean not null default false,
  inserted integer not null default 0,
  matched integer not null default 0,
  duplicates integer not null default 0,
  cadence_updates integer not null default 0,
  skipped integer not null default 0,
  summary text not null default '',
  error text,
  result jsonb not null default '{}'::jsonb
);

create index if not exists sync_log_ran_at_idx
  on jasonos.sync_log (ran_at desc);

alter table jasonos.sync_log enable row level security;

-- Seed the last known run per source so the log is not empty on first visit.
insert into jasonos.sync_log (
  ran_at, source, ok, unavailable, inserted, matched, duplicates,
  cadence_updates, skipped, summary, error, result
)
select
  last_synced_at,
  source,
  case
    when last_result ? 'ok' then coalesce((last_result->>'ok')::boolean, true)
    else (last_result->>'error') is null
  end,
  coalesce((last_result->>'unavailable')::boolean, false),
  coalesce((last_result->>'inserted')::int, 0),
  coalesce((last_result->>'matched')::int, 0),
  coalesce((last_result->>'duplicates')::int, 0),
  coalesce((last_result->>'cadenceUpdates')::int, 0),
  coalesce((last_result->>'skipped')::int, 0),
  '',
  last_result->>'error',
  coalesce(last_result, '{}'::jsonb)
from jasonos.outreach_sync_state
where last_synced_at is not null
  and not exists (
    select 1 from jasonos.sync_log existing
    where existing.source = jasonos.outreach_sync_state.source
      and existing.ran_at = jasonos.outreach_sync_state.last_synced_at
  );

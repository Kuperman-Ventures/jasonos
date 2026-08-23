-- Persist Inbox Dispatch saved + dismissed threads across sessions and devices.
-- Previously lived only in browser localStorage.

alter table public.user_preferences
  add column if not exists inbox_dispatch_saved jsonb not null default '[]'::jsonb;

alter table public.user_preferences
  add column if not exists inbox_dispatch_dismissed jsonb not null default '[]'::jsonb;

comment on column public.user_preferences.inbox_dispatch_saved is
  'Saved Inbox Dispatch threads (boarding/holding snapshots) until Jason dismisses them.';

comment on column public.user_preferences.inbox_dispatch_dismissed is
  'Gmail thread ids dismissed from Inbox Dispatch (hidden from today + saved).';

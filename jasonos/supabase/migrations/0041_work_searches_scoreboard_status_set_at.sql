-- Track when Jason last manually set a scoreboard status, and age
-- untouched "submitted" (blue) applications to "no_reply" (orange)
-- after 30 days from the application date (or last manual set).

alter table public.work_searches
  add column if not exists scoreboard_status_set_at timestamptz;

comment on column public.work_searches.scoreboard_status_set_at is
  'When scoreboard_status was last set by hand. Used to age submitted → no_reply after 30 days.';

-- Backfill: for rows still on submitted whose application date is already
-- 30+ days old, flip them to no_reply now.
update public.work_searches
set
  scoreboard_status = 'no_reply',
  scoreboard_status_set_at = coalesce(scoreboard_status_set_at, now())
where scoreboard_status = 'submitted'
  and date <= (current_date - 30);

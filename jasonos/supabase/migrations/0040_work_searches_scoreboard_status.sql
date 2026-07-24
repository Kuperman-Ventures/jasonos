-- Scoreboard pipeline status for NYUI work-search applications.
-- Separate from the compliance `result` field so Jason can track
-- submitted → no reply → next steps → rejected / offer without
-- rewriting the DOL audit log.

alter table public.work_searches
  add column if not exists scoreboard_status text;

alter table public.work_searches
  drop constraint if exists work_searches_scoreboard_status_check;

alter table public.work_searches
  add constraint work_searches_scoreboard_status_check
  check (
    scoreboard_status is null
    or scoreboard_status in (
      'submitted',
      'no_reply',
      'next_steps',
      'rejected',
      'offer'
    )
  );

comment on column public.work_searches.scoreboard_status is
  'Scoreboard pipeline status: submitted / no_reply / next_steps / rejected / offer.';

-- Seed from the existing NYUI result field where we can map cleanly.
update public.work_searches
set scoreboard_status = case
  when result = 'Offer Received' then 'offer'
  when result = 'Rejected' then 'rejected'
  when result = 'Interview Scheduled' then 'next_steps'
  when result = 'Application Submitted' then 'submitted'
  when result = 'Pending' then 'no_reply'
  else 'submitted'
end
where scoreboard_status is null
  and (
    contact_method in ('Online Portal', 'Direct Email')
    or result in (
      'Application Submitted',
      'Rejected',
      'Offer Received',
      'Interview Scheduled',
      'Pending'
    )
  );

create index if not exists work_searches_scoreboard_status_idx
  on public.work_searches (scoreboard_status)
  where scoreboard_status is not null;

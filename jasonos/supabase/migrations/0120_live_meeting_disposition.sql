-- Live Start: hide a meeting from Upcoming, or mark it as needing no deck.
set search_path = jasonos, public;

alter table jasonos.meeting_preps
  add column if not exists live_disposition text;

do $$ begin
  alter table jasonos.meeting_preps
    add constraint meeting_preps_live_disposition_check
    check (live_disposition is null or live_disposition in ('no_deck', 'hidden'));
exception when duplicate_object then null; end $$;

comment on column jasonos.meeting_preps.live_disposition is
  'Live Start Upcoming list: null (normal), no_deck (skip deck for this meeting), hidden (removed from list).';

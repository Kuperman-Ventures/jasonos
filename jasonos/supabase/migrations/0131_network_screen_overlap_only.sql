set search_path = jasonos, public;

alter table jasonos.network_screens
  drop constraint if exists network_screens_status_check;

alter table jasonos.network_screens
  add constraint network_screens_status_check
  check (status in (
    'awaiting_capture', 'captured', 'overlap_only', 'scored', 'drafted', 'requested', 'archived'
  ));

alter table jasonos.network_screen_candidates
  drop constraint if exists network_screen_candidates_lane_check;

alter table jasonos.network_screen_candidates
  add constraint network_screen_candidates_lane_check
  check (lane in (
    'unassigned', 'job_search', 'advisors', 'industry', 'already_connected', 'none'
  ));

comment on column jasonos.network_screens.status is
  'awaiting_capture, captured, overlap_only (LinkedIn only exposed mutuals), scored, drafted, requested, archived';

comment on column jasonos.network_screen_candidates.lane is
  'job_search, advisors, industry, already_connected (1st-degree mutual), none, or unassigned before scoring';

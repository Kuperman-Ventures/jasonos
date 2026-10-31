set search_path = jasonos, public;

alter table jasonos.network_screen_candidates
  add column if not exists lane text not null default 'unassigned'
    check (lane in ('unassigned', 'job_search', 'advisors', 'industry', 'none'));

alter table jasonos.network_screen_candidates
  drop constraint if exists network_screen_candidates_bucket_check;

alter table jasonos.network_screen_candidates
  add constraint network_screen_candidates_bucket_check
  check (bucket in (
    'unscored', 'hiring_path', 'recruiter', 'peer_referral', 'speaking_content',
    'prospect', 'operating_partner', 'industry_peer', 'not_relevant'
  ));

create index if not exists network_screen_candidates_lane_idx
  on jasonos.network_screen_candidates (lane, tier) where lane <> 'none';

comment on column jasonos.network_screen_candidates.lane is
  'Which part of Jason''s work this person serves: job_search, advisors (Kuperman Advisors prospect or referral), industry (worth knowing), or none.';

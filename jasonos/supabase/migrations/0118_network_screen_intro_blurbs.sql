set search_path = jasonos, public;

alter table jasonos.network_screen_candidates
  add column if not exists intro_blurb text,
  add column if not exists intro_blurb_generated_at timestamptz;

alter table jasonos.network_screens
  add column if not exists include_blurbs_in_email boolean not null default false;

comment on column jasonos.network_screen_candidates.intro_blurb is
  'Forwardable intro paragraph written in the connector''s voice, for the connector to paste into their email to this person.';

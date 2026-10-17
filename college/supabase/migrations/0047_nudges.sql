-- Reminder emails: cached one-line explanations and the send/schedule log.

alter table college.app_state
  add column if not exists nudge_blurbs jsonb not null default '{}'::jsonb;

alter table college.app_state
  add column if not exists nudges jsonb not null default '[]'::jsonb;

comment on column college.app_state.nudge_blurbs is
  'One-sentence explanation keyed by timeline stage id or to-do id.';

comment on column college.app_state.nudges is
  'Admin reminder sends. schedule is now, {at}, or {recurring:weekly,day:fri,time:08:00,nextAt}.';

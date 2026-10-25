-- Family Meeting: persist per-series icon overrides for the editor.

set search_path = jasonos, public;

alter table jasonos.family_meeting_series_edits
  add column if not exists icon_id text;

comment on column jasonos.family_meeting_series_edits.icon_id is
  'Optional FamilyMeetingIconId override. NULL means auto (keyword discern).';

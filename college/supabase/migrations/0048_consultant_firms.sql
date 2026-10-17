-- Saved consultant cards. Null means the app still uses the seed list.

alter table college.app_state
  add column if not exists consultant_firms jsonb;

comment on column college.app_state.consultant_firms is
  'Consultant cards edited in the portal. Null uses the seed list.';

-- Persist college-list sort key and direction per member.

alter table college.member_prefs
  add column if not exists colleges_sort jsonb not null default '{"key":"list","dir":1}'::jsonb;

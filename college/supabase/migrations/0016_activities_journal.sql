-- Student Activities journal (My Activities / Awards / Application Prep).
-- One JSON blob on app_state — same pattern as note_items.

alter table college.app_state
  add column if not exists activities_journal jsonb not null default '{"activities":[],"awards":[],"applicationLists":[]}'::jsonb;

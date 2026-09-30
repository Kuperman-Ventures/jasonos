-- Editable Follow Up email guidance prompt (Settings → General).
-- null / empty means use the in-code default.

alter table public.user_preferences
  add column if not exists meeting_followup_prompt text;

comment on column public.user_preferences.meeting_followup_prompt is
  'Guidance prompt for meeting Follow Up draft generation. Null uses the app default. Placeholders: {{firstName}}, {{greeting}}, {{whenPhrase}}.';

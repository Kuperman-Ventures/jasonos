-- About Jason (Settings) for intro emails + meeting prep short ask / Granola link.

alter table public.user_preferences
  add column if not exists about_jason text;

comment on column public.user_preferences.about_jason is
  'Freeform About Jason blurb for intro rationales and forwardable intro emails.';

alter table jasonos.meetings
  add column if not exists prep_short_ask text,
  add column if not exists granola_note_id text,
  add column if not exists granola_url text;

comment on column jasonos.meetings.prep_short_ask is
  'Meeting-scoped soft ask used in forwardable intro emails (e.g. 20-30 min Zoom).';
comment on column jasonos.meetings.granola_note_id is
  'Granola note id linked when the call log was imported.';
comment on column jasonos.meetings.granola_url is
  'Granola note URL for the imported call log.';

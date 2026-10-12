-- Fuck You Batman entry review loop.
--
-- Jason can approve a published story entry or send it back with a note.
-- Saving an entry again returns it to draft and clears the note, so Claude
-- must re-read change_request before revising. Status values: draft,
-- approved, changes_requested.
--
-- Service-role only, same arrangement as 0089_fyb_story.sql.
-- No seed data: the repository is public.

set search_path = jasonos, public;

alter table jasonos.fyb_entries
  drop constraint if exists fyb_entries_status_check;

alter table jasonos.fyb_entries
  add constraint fyb_entries_status_check
  check (status in ('draft', 'approved', 'changes_requested'));

alter table jasonos.fyb_entries
  add column if not exists change_request text;

alter table jasonos.fyb_entries
  add column if not exists change_requested_at timestamptz;

comment on column jasonos.fyb_entries.change_request is
  'Jason''s note when status is changes_requested. Cleared on the next save.';

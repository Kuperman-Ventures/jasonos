-- LOTR standalone project page at /projects/lotr.
-- Independent of JasonOS login/chrome, same arrangement as oversight-agenda.

set search_path = jasonos, public;

insert into jasonos.project_pages (slug, title, track, status, description)
values (
  'lotr',
  'LOTR',
  'personal',
  'active',
  'Standalone LOTR project surface outside JasonOS login and chrome.'
)
on conflict (slug) do update set
  title = excluded.title,
  track = excluded.track,
  status = excluded.status,
  description = excluded.description,
  updated_at = now();

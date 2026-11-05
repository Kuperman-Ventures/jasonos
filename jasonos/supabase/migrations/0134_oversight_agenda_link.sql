-- Oversight Agenda Dashboard artifact on /projects/oversight-agenda.
-- Service-role only, same arrangement as 0094_project_links.sql.

insert into jasonos.project_links (project_slug, title, url, kind, description, sort_order)
values (
  'oversight-agenda',
  'Oversight Agenda Dashboard (Claude artifact)',
  'https://claude.ai/artifact/WCJ5nxP6uJvbE6Eh378mPh',
  'artifact',
  'Standalone HTML version of the dashboard.',
  1
)
on conflict (project_slug, url) do nothing;

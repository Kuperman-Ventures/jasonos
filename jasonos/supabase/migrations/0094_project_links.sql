-- Plans and artifacts filed under a JasonOS project page.
-- project_slug matches the route under /projects, e.g. ski-tracker.
-- Service-role only, same arrangement as 0091_library.sql.
-- No anon/authenticated policies. 0087 revoked those roles by default.

set search_path = jasonos, public;

create table if not exists jasonos.project_links (
  id uuid primary key default gen_random_uuid(),
  project_slug text not null,
  title text not null,
  url text not null,
  kind text not null default 'artifact',
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (project_slug, url),
  constraint project_links_kind_check check (kind in ('artifact', 'doc', 'file', 'other'))
);

create index if not exists project_links_slug_sort_idx
  on jasonos.project_links (project_slug, sort_order);

comment on table jasonos.project_links is
  'Plans, artifacts, and docs shown on a project page. Keyed by the URL slug under /projects.';

comment on column jasonos.project_links.project_slug is
  'Matches the route under /projects, e.g. ski-tracker.';

comment on column jasonos.project_links.kind is
  'artifact, doc, file, or other.';

alter table jasonos.project_links enable row level security;

revoke all on table jasonos.project_links from anon, authenticated;
grant all on table jasonos.project_links to service_role;

insert into jasonos.project_links (project_slug, title, url, kind, description, sort_order)
values
  (
    'ski-tracker',
    'Build Plan',
    'https://claude.ai/artifact/8j5BLgz1B8VTfTmsN2n6cT',
    'artifact',
    'Three-week plan with timeline and coachable subtasks for Phases 0-2.',
    1
  ),
  (
    'ski-tracker',
    'How the Ski Tracker Works',
    'https://claude.ai/artifact/UssrCNngjg8iM1LmWF6Lxr',
    'artifact',
    'Two-sided printable diagram: generic web app concepts and the Ski Tracker version.',
    2
  )
on conflict (project_slug, url) do nothing;

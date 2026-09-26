-- Household members for The Track.
-- Browser clients never query this schema. The Next server checks membership,
-- then reads and writes with the service role.

create table if not exists college.members (
  id text primary key,
  email text unique,
  display_name text not null,
  role text not null check (role in ('super_admin', 'parent', 'student', 'sibling', 'guest')),
  ui_visible boolean not null default true,
  auth_user_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table college.members enable row level security;

revoke all on college.members from public, anon, authenticated;
grant all on college.members to service_role;

insert into college.members (id, email, display_name, role, ui_visible, auth_user_id) values
  ('jason', 'jason@kupermanadvisors.com', 'Jason', 'super_admin', true, 'f4591f07-b8bf-4979-b1c2-5aeefac71937'),
  ('kat', null, 'Kat', 'parent', true, null),
  ('kyle', null, 'Kyle', 'student', true, null),
  ('wyatt', null, 'Wyatt', 'sibling', false, null),
  ('guest', null, 'Guest', 'guest', false, null)
on conflict (id) do update set
  display_name = excluded.display_name,
  role = excluded.role,
  ui_visible = excluded.ui_visible,
  auth_user_id = coalesce(college.members.auth_user_id, excluded.auth_user_id),
  updated_at = now();

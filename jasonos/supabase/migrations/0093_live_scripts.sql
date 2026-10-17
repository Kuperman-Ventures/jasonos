-- Live scripts: named point lists with no meeting attached.
-- Applying a script copies items into meeting_points. Later edits stay separate.
-- Service-role only, same arrangement as 0092_meeting_points.sql.
-- Safe to re-run.

set search_path = jasonos, public;

create table if not exists jasonos.live_scripts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  use_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_scripts_name_key unique (name)
);

comment on table jasonos.live_scripts is
  'Reusable call plans. Not tied to a calendar event. use_count increments when Jason applies one to a meeting.';

create table if not exists jasonos.live_script_items (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references jasonos.live_scripts(id) on delete cascade,
  position integer not null,
  kind text not null default 'point'
    check (kind in ('agenda', 'point', 'question', 'ask')),
  headline text not null,
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_script_items_script_idx
  on jasonos.live_script_items (script_id, position);

comment on table jasonos.live_script_items is
  'Ordered headlines in a script. No state and no notes; those exist only on a meeting.';

comment on column jasonos.live_script_items.headline is
  'May contain {{name}}, {{company}}, or {{title}}. Filled when the script is applied to a meeting.';

drop trigger if exists live_scripts_set_updated_at on jasonos.live_scripts;
create trigger live_scripts_set_updated_at
  before update on jasonos.live_scripts
  for each row execute function jasonos.set_updated_at();

drop trigger if exists live_script_items_set_updated_at on jasonos.live_script_items;
create trigger live_script_items_set_updated_at
  before update on jasonos.live_script_items
  for each row execute function jasonos.set_updated_at();

alter table jasonos.live_scripts enable row level security;
alter table jasonos.live_script_items enable row level security;

revoke all on table jasonos.live_scripts from anon, authenticated;
revoke all on table jasonos.live_script_items from anon, authenticated;

-- Live database names this check meeting_points_source_check.
alter table jasonos.meeting_points
  drop constraint if exists meeting_points_source_check;
alter table jasonos.meeting_points
  add constraint meeting_points_source_check
  check (source in ('user', 'ai', 'script'));

alter table jasonos.meeting_points
  add column if not exists script_id uuid references jasonos.live_scripts(id) on delete set null;

alter table jasonos.meeting_preps
  add column if not exists script_id uuid references jasonos.live_scripts(id) on delete set null;

comment on column jasonos.meeting_points.script_id is
  'The script this row was copied from. Null when Jason wrote the line himself.';

comment on column jasonos.meeting_preps.script_id is
  'The last script applied to this meeting. Editing points does not clear it.';

create or replace function jasonos.reorder_live_script_items(
  p_script_id uuid,
  p_ids uuid[]
) returns void
language plpgsql
set search_path = jasonos, public
as $$
declare
  existing_count int;
  matched int;
begin
  if p_script_id is null then
    raise exception 'Script not found.';
  end if;

  select count(*) into existing_count
  from jasonos.live_script_items
  where script_id = p_script_id;

  select count(*) into matched
  from jasonos.live_script_items as item
  join unnest(coalesce(p_ids, array[]::uuid[])) as listed(id) on listed.id = item.id
  where item.script_id = p_script_id;

  if existing_count <> coalesce(cardinality(p_ids), 0) or matched <> existing_count then
    raise exception 'Point order does not match this script.';
  end if;

  update jasonos.live_script_items as item
  set position = listed.position
  from (
    select id, ordinality::int as position
    from unnest(p_ids) with ordinality as listed(id, ordinality)
  ) as listed
  where item.id = listed.id
    and item.script_id = p_script_id;
end;
$$;

revoke all on function jasonos.reorder_live_script_items(uuid, uuid[]) from public, anon, authenticated;
grant execute on function jasonos.reorder_live_script_items(uuid, uuid[]) to service_role;

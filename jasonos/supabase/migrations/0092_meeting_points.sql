-- Live call points: one ordered list per meeting prep.
-- Service-role only, same arrangement as the other JasonOS tables.
-- No anon/authenticated policies. 0087 revoked those roles by default.
-- Kupe runs this by hand in the Supabase SQL Editor. It is safe to re-run.

set search_path = jasonos, public;

create table if not exists jasonos.meeting_points (
  id uuid primary key default gen_random_uuid(),
  prep_id uuid not null references jasonos.meeting_preps(id) on delete cascade,
  position integer not null,
  kind text not null default 'point'
    check (kind in ('agenda', 'point', 'question', 'ask')),
  headline text not null,
  detail text,
  state text not null default 'open'
    check (state in ('open', 'covered', 'skipped')),
  state_changed_at timestamptz,
  note text,
  source text not null default 'user'
    check (source in ('user', 'ai')),
  edited_by_user boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meeting_points_prep_idx
  on jasonos.meeting_points (prep_id, position);

comment on table jasonos.meeting_points is
  'Headlines Jason wants to hit on a call. Order is his plan. State is what he did with each one during the call.';

comment on column jasonos.meeting_points.kind is
  'agenda is a section heading. point, question, and ask are lines he can mark.';

comment on column jasonos.meeting_points.edited_by_user is
  'True once Jason changes the line. Drafting never updates or deletes an existing row.';

drop trigger if exists meeting_points_set_updated_at on jasonos.meeting_points;
create trigger meeting_points_set_updated_at
  before update on jasonos.meeting_points
  for each row execute function jasonos.set_updated_at();

alter table jasonos.meeting_points enable row level security;

revoke all on table jasonos.meeting_points from anon, authenticated;

alter table jasonos.meeting_preps
  add column if not exists live_started_at timestamptz,
  add column if not exists live_ended_at timestamptz;

comment on column jasonos.meeting_preps.live_started_at is
  'Set the first time the live call screen opens. Later opens keep this clock.';

comment on column jasonos.meeting_preps.live_ended_at is
  'Set when Jason hits Done on the live call screen.';

-- One update rewrites every position. The service-role client has no raw SQL.
create or replace function jasonos.reorder_meeting_points(
  p_prep_id uuid,
  p_ids uuid[]
) returns void
language plpgsql
set search_path = jasonos, public
as $$
declare
  existing_count int;
  matched int;
begin
  if p_prep_id is null then
    raise exception 'Meeting prep not found.';
  end if;

  select count(*) into existing_count
  from jasonos.meeting_points
  where prep_id = p_prep_id;

  select count(*) into matched
  from jasonos.meeting_points as point
  join unnest(coalesce(p_ids, array[]::uuid[])) as listed(id) on listed.id = point.id
  where point.prep_id = p_prep_id;

  if existing_count <> coalesce(cardinality(p_ids), 0) or matched <> existing_count then
    raise exception 'Point order does not match this meeting.';
  end if;

  update jasonos.meeting_points as point
  set position = listed.position
  from (
    select id, ordinality::int as position
    from unnest(p_ids) with ordinality as listed(id, ordinality)
  ) as listed
  where point.id = listed.id
    and point.prep_id = p_prep_id;
end;
$$;

revoke all on function jasonos.reorder_meeting_points(uuid, uuid[]) from public, anon, authenticated;
grant execute on function jasonos.reorder_meeting_points(uuid, uuid[]) to service_role;

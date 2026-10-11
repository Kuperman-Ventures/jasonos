-- Connections Register: every access grant across Jason's accounts,
-- automation tools (Zapier, Claude scheduled tasks, Claude connectors,
-- Google linked apps) and the apps they reach.
--
-- Service-role only. The JasonOS server (Settings -> Connections) and the
-- JasonOS MCP read and write these tables. There is no seed data in this
-- file on purpose: the repository is public, so rows are loaded through the
-- JasonOS MCP tools after deploy.

set search_path = jasonos, public;

-- One row per access grant: this account gave this tool this access.
create table if not exists jasonos.connection_grants (
  id text primary key,
  identity text not null,
  hub text not null,
  target text not null,
  access text not null default '',
  used_by text not null default '',
  status text not null default 'unverified'
    check (status in ('in_use', 'unverified', 'no_use_found', 'turned_off', 'revoked')),
  evidence text not null default '',
  check_at text not null default '',
  verified_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null default 'jasonos'
);

create index if not exists connection_grants_status_idx
  on jasonos.connection_grants (status);
create index if not exists connection_grants_hub_idx
  on jasonos.connection_grants (hub);

comment on table jasonos.connection_grants is
  'Connections Register: one row per access grant (account -> tool -> app).';

-- Details for each box on the map, keyed by the exact name used in grants
-- (identity, hub or target). items holds lists such as the connectors
-- attached to a scheduled task.
create table if not exists jasonos.connection_nodes (
  name text primary key,
  about text not null default '',
  manage jsonb not null default '[]'::jsonb,
  items jsonb not null default '[]'::jsonb,
  items_label text,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'jasonos'
);

comment on table jasonos.connection_nodes is
  'Connections Register: description, manage links and attached-item lists for each map box.';

-- Which sources of grants have been inventoried.
create table if not exists jasonos.connection_coverage (
  id text primary key,
  source text not null,
  state text not null default 'Not checked'
    check (state in ('Done', 'Partial', 'Not checked')),
  note text not null default '',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'jasonos'
);

comment on table jasonos.connection_coverage is
  'Connections Register: each source of grants and whether it has been checked.';

-- Change history for grants, written by trigger so every writer (Settings
-- page, MCP, SQL) is captured. Used for the monthly review of what changed.
create table if not exists jasonos.connection_events (
  id uuid primary key default gen_random_uuid(),
  grant_id text not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  changes jsonb not null default '{}'::jsonb,
  actor text not null default 'jasonos',
  created_at timestamptz not null default now()
);

create index if not exists connection_events_created_idx
  on jasonos.connection_events (created_at desc);
create index if not exists connection_events_grant_idx
  on jasonos.connection_events (grant_id, created_at desc);

comment on table jasonos.connection_events is
  'Connections Register: history of grant changes (created, updated with field diffs, deleted).';

create or replace function jasonos.log_connection_grant_change()
returns trigger
language plpgsql
as $$
declare
  diff jsonb := '{}'::jsonb;
  k text;
begin
  if tg_op = 'INSERT' then
    insert into jasonos.connection_events (grant_id, action, changes, actor)
    values (new.id, 'created', to_jsonb(new) - 'created_at' - 'updated_at' - 'updated_by', new.updated_by);
    return new;
  elsif tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(to_jsonb(new)) loop
      if k not in ('created_at', 'updated_at', 'updated_by')
         and (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
        diff := diff || jsonb_build_object(
          k, jsonb_build_object('from', to_jsonb(old) -> k, 'to', to_jsonb(new) -> k)
        );
      end if;
    end loop;
    if diff <> '{}'::jsonb then
      insert into jasonos.connection_events (grant_id, action, changes, actor)
      values (new.id, 'updated', diff, new.updated_by);
    end if;
    return new;
  else
    -- The app sets updated_by to the deleting actor just before deleting.
    insert into jasonos.connection_events (grant_id, action, changes, actor)
    values (old.id, 'deleted', to_jsonb(old) - 'created_at' - 'updated_at' - 'updated_by', old.updated_by);
    return old;
  end if;
end;
$$;

drop trigger if exists connection_grants_log on jasonos.connection_grants;
create trigger connection_grants_log
  after insert or update or delete on jasonos.connection_grants
  for each row execute function jasonos.log_connection_grant_change();

drop trigger if exists connection_grants_set_updated_at on jasonos.connection_grants;
create trigger connection_grants_set_updated_at
  before update on jasonos.connection_grants
  for each row execute function jasonos.set_updated_at();

drop trigger if exists connection_nodes_set_updated_at on jasonos.connection_nodes;
create trigger connection_nodes_set_updated_at
  before update on jasonos.connection_nodes
  for each row execute function jasonos.set_updated_at();

drop trigger if exists connection_coverage_set_updated_at on jasonos.connection_coverage;
create trigger connection_coverage_set_updated_at
  before update on jasonos.connection_coverage
  for each row execute function jasonos.set_updated_at();

alter table jasonos.connection_grants enable row level security;
alter table jasonos.connection_nodes enable row level security;
alter table jasonos.connection_coverage enable row level security;
alter table jasonos.connection_events enable row level security;

-- No anon/authenticated policies: only the service role (JasonOS server and
-- JasonOS MCP) reads and writes. Service role bypasses RLS.

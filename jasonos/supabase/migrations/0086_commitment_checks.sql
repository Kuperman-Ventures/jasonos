-- Commitment Check on the JasonOS home page.
--
-- The weekday Commitment Check (a Claude scheduled task) reads Jason's sent
-- Gmail and Granola notes for promises with a time attached, then publishes
-- one row per Eastern date here through the JasonOS MCP tool
-- publish_commitment_check (or POST /api/commitment-check/publish). The home
-- panel reads the latest row.
--
-- commitment_item_states keeps what Jason does on the home panel (done,
-- dismissed, snoozed) keyed by each item's stable key, so a promise marked
-- done stays hidden when the next day's check lists it again.
--
-- Service-role only, same arrangement as the other published home modules.
-- No seed data: the repository is public.

set search_path = jasonos, public;

create table if not exists jasonos.commitment_checks (
  id uuid primary key default gen_random_uuid(),
  check_date date not null unique,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commitment_checks_check_date_desc_idx
  on jasonos.commitment_checks (check_date desc);

comment on table jasonos.commitment_checks is
  'One published Commitment Check per Eastern date. payload is a CommitmentCheckPayload (lib/commitments/types.ts).';

create table if not exists jasonos.commitment_item_states (
  item_key text primary key,
  state text not null check (state in ('done', 'dismissed', 'snoozed')),
  snoozed_until date,
  note text,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'jasonos'
);

comment on table jasonos.commitment_item_states is
  'What Jason did with a commitment on Home (done, dismissed, snoozed), keyed by the item key in the published payload.';

drop trigger if exists commitment_checks_set_updated_at on jasonos.commitment_checks;
create trigger commitment_checks_set_updated_at
  before update on jasonos.commitment_checks
  for each row execute function jasonos.set_updated_at();

drop trigger if exists commitment_item_states_set_updated_at on jasonos.commitment_item_states;
create trigger commitment_item_states_set_updated_at
  before update on jasonos.commitment_item_states
  for each row execute function jasonos.set_updated_at();

alter table jasonos.commitment_checks enable row level security;
alter table jasonos.commitment_item_states enable row level security;

-- No anon/authenticated policies: only the service role (JasonOS server and
-- JasonOS MCP) reads and writes. Service role bypasses RLS.

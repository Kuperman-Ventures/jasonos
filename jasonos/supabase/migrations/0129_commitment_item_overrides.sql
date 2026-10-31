-- Manual edits Jason makes on Home (click the quoted promise) so wording,
-- recipient, and due date survive the next weekday Commitment Check publish.

set search_path = jasonos, public;

create table if not exists jasonos.commitment_item_overrides (
  item_key text primary key,
  promise text not null,
  "to" text not null,
  due_date date,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'jasonos'
);

comment on table jasonos.commitment_item_overrides is
  'Home edits to a commitment quote (promise / to / due_date), keyed by item key. Applied on top of the published check so republish keeps Jason''s wording.';

drop trigger if exists commitment_item_overrides_set_updated_at on jasonos.commitment_item_overrides;
create trigger commitment_item_overrides_set_updated_at
  before update on jasonos.commitment_item_overrides
  for each row execute function jasonos.set_updated_at();

alter table jasonos.commitment_item_overrides enable row level security;

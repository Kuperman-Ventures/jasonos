-- Allow Commitment Check items to be marked scheduled after Jason puts
-- a work block on the calendar from Home.

set search_path = jasonos, public;

alter table jasonos.commitment_item_states
  drop constraint if exists commitment_item_states_state_check;

alter table jasonos.commitment_item_states
  add constraint commitment_item_states_state_check
  check (state in ('done', 'dismissed', 'snoozed', 'scheduled'));

comment on table jasonos.commitment_item_states is
  'What Jason did with a commitment on Home (done, dismissed, snoozed, scheduled), keyed by the item key in the published payload.';

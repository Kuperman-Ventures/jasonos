-- The time they picked in reply, and a short excerpt of that reply.

set search_path = jasonos, public;

alter table jasonos.browning_handoffs
  add column if not exists reply_excerpt text;

alter table jasonos.browning_handoffs
  add column if not exists chosen_slot_start timestamptz;

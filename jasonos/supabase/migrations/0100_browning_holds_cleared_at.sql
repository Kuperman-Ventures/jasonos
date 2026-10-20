-- Remember that tentative holds were removed after a meeting was set,
-- so Sync does not keep re-listing Google for every booked handoff.

set search_path = jasonos, public;

alter table jasonos.browning_handoffs
  add column if not exists holds_cleared_at timestamptz;

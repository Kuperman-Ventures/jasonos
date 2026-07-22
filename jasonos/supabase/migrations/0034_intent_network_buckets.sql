-- Re-cast Intent buckets to the networking model:
--   warm/specific → network_growth      (actively building; counts)
--   is_networking=false → network_maintenance (tracked, doesn't count)
--   cold → browning_cold                 (cold outreach / Browning program)
--   backrow → backrow                    (archived; unchanged)
-- Then backfill is_networking from the new intent (kept for back-compat but no
-- longer edited in the UI — the bucket now defines that state).

alter table jasonos.contacts drop constraint if exists contacts_intent_check;

-- Maintenance first: whatever you'd flagged as "not networking" via the rocker.
update jasonos.contacts
  set intent = 'network_maintenance'
  where is_networking = false and (intent is null or intent <> 'backrow');

update jasonos.contacts set intent = 'browning_cold' where intent = 'cold';
update jasonos.contacts set intent = 'network_growth' where intent in ('warm', 'specific');

-- Keep is_networking consistent with the new bucket.
update jasonos.contacts
  set is_networking = (intent is distinct from 'network_maintenance');

alter table jasonos.contacts
  add constraint contacts_intent_check
  check (
    intent is null
    or intent in ('network_growth', 'network_maintenance', 'browning_cold', 'backrow')
  );

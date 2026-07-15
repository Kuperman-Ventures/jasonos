-- 0029_contacts_cadence_add_triweekly.sql
-- ---------------------------------------------------------------------------
-- Allow the new "triweekly" (every 3 weeks / 21-day) cadence interval on
-- jasonos.contacts. The existing CHECK constraint only permitted weekly,
-- biweekly, monthly, quarterly, none — so setting a contact to triweekly
-- failed with contacts_cadence_interval_check. Recreate it with triweekly.
-- ---------------------------------------------------------------------------

alter table jasonos.contacts
  drop constraint if exists contacts_cadence_interval_check;

alter table jasonos.contacts
  add constraint contacts_cadence_interval_check
  check (
    cadence_interval is null
    or cadence_interval = any (
      array['weekly','biweekly','triweekly','monthly','quarterly','none']::text[]
    )
  );

-- 0045_contacts_network_role.sql
-- ---------------------------------------------------------------------------
-- Network role: how a contact fits the job search.
--   buyer           — may hire you or help toward a role at their company
--   buyer_referrer  — could hire you and also connect you onward
--   referrer        — connects you to others; not a hiring path themselves
-- Nullable and additive — no existing column/behavior changes. Surfaces as a
-- classification in the networking report.
-- ---------------------------------------------------------------------------

alter table jasonos.contacts
  add column if not exists network_role text;

alter table jasonos.contacts
  drop constraint if exists contacts_network_role_check;
alter table jasonos.contacts
  add constraint contacts_network_role_check
  check (network_role is null or network_role in ('buyer', 'buyer_referrer', 'referrer'));

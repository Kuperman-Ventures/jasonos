-- 0025_contact_relevance_and_network_degree.sql
-- ---------------------------------------------------------------------------
-- Two new contact classification vectors, surfaced as dropdowns in People:
--   relevance_tier  A (most relevant to me) .. B .. C (least relevant)
--   network_degree  1 (I know them well), 2 (introduced by a 1),
--                   3 (introduced by a 2)
-- Both are nullable and additive — no existing column/behavior changes.
-- ---------------------------------------------------------------------------

alter table jasonos.contacts
  add column if not exists relevance_tier text,
  add column if not exists network_degree smallint;

alter table jasonos.contacts
  drop constraint if exists contacts_relevance_tier_check;
alter table jasonos.contacts
  add constraint contacts_relevance_tier_check
  check (relevance_tier is null or relevance_tier in ('A', 'B', 'C'));

alter table jasonos.contacts
  drop constraint if exists contacts_network_degree_check;
alter table jasonos.contacts
  add constraint contacts_network_degree_check
  check (network_degree is null or network_degree in (1, 2, 3));

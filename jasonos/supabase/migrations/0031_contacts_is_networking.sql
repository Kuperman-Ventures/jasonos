-- Distinguish networking relationships from frequent/operational contacts.
-- When false, the contact is excluded from the networking Weekly Report and
-- the networking funnel (e.g. people you speak to constantly for operational
-- reasons that shouldn't count as networking outreach). Defaults to true so
-- every existing contact keeps counting.
alter table jasonos.contacts
  add column if not exists is_networking boolean not null default true;

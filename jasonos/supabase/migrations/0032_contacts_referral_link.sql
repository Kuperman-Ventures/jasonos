-- Referral link: who introduced you to this contact. Powers the networking
-- funnel (which of my contacts connect me with new people) and the
-- referred-contact outreach tracking. Nullable; ON DELETE SET NULL so removing
-- a referrer just unlinks rather than deleting the referred contact.
alter table jasonos.contacts
  add column if not exists referred_by_contact_id uuid
    references jasonos.contacts(id) on delete set null,
  add column if not exists referred_at date;

create index if not exists idx_contacts_referred_by
  on jasonos.contacts (referred_by_contact_id)
  where referred_by_contact_id is not null;

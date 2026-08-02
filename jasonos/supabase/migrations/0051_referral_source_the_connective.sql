-- 0051_referral_source_the_connective.sql
-- ---------------------------------------------------------------------------
-- Seed The Connective as a selectable "referred by" source, matching Boardy /
-- Browning (migration 0047). Real contact row so referred_by_contact_id works;
-- tagged referral_source; kept in backrow / not-networking so it never enters
-- the outreach queue.
-- ---------------------------------------------------------------------------

insert into jasonos.contacts (name, intent, tags, is_networking, cadence_interval)
select 'The Connective', 'backrow', array['referral_source']::text[], false, 'none'
where not exists (
  select 1 from jasonos.contacts where lower(name) = 'the connective'
);

update jasonos.contacts
set
  tags = case
    when tags @> array['referral_source']::text[] then tags
    else array_append(tags, 'referral_source')
  end,
  intent = coalesce(intent, 'backrow'),
  is_networking = false
where lower(name) = 'the connective';

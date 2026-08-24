-- 0063_referral_source_job_application.sql
-- ---------------------------------------------------------------------------
-- Seed Job Application as a selectable "referred by" source, matching Boardy /
-- Browning / The Connective (migrations 0047, 0051). Real contact row so
-- referred_by_contact_id works; tagged referral_source; kept in backrow /
-- not-networking so it never enters the outreach queue.
-- ---------------------------------------------------------------------------

insert into jasonos.contacts (name, intent, tags, is_networking, cadence_interval)
select 'Job Application', 'backrow', array['referral_source']::text[], false, 'none'
where not exists (
  select 1 from jasonos.contacts where lower(name) = 'job application'
);

update jasonos.contacts
set
  tags = case
    when tags @> array['referral_source']::text[] then tags
    else array_append(tags, 'referral_source')
  end,
  intent = coalesce(intent, 'backrow'),
  is_networking = false
where lower(name) = 'job application';

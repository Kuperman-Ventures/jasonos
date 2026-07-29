-- 0047_referral_sources_browning_boardy.sql
-- ---------------------------------------------------------------------------
-- Seed Browning and Boardy as selectable "referred by" sources.
-- Real contact rows (so referred_by_contact_id FK still works), tagged
-- referral_source, kept in backrow / not-networking so they never enter the
-- outreach queue. The Cold intent column is separate — its UI label is "Cold".
-- ---------------------------------------------------------------------------

insert into jasonos.contacts (name, intent, tags, is_networking, cadence_interval)
select 'Browning', 'backrow', array['referral_source']::text[], false, 'none'
where not exists (
  select 1 from jasonos.contacts where lower(name) = 'browning'
);

insert into jasonos.contacts (name, intent, tags, is_networking, cadence_interval)
select 'Boardy', 'backrow', array['referral_source']::text[], false, 'none'
where not exists (
  select 1 from jasonos.contacts where lower(name) = 'boardy'
);

update jasonos.contacts
set
  tags = case
    when tags @> array['referral_source']::text[] then tags
    else array_append(tags, 'referral_source')
  end,
  intent = coalesce(intent, 'backrow'),
  is_networking = false
where lower(name) in ('browning', 'boardy');

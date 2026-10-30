-- Stop Lu.ma / webinar platform invites from sticking to real contacts.
-- Removes calendar-invite@lu.ma from contact email arrays and deletes the
-- Ved Rasic meetings/touches those invites created.

set search_path = jasonos, public;

-- Remove the Lu.ma invite address from every contact row that carries it.
update jasonos.contacts
set emails = array_remove(emails, 'calendar-invite@lu.ma')
where 'calendar-invite@lu.ma' = any(emails);

-- Delete the meetings and touches the Lu.ma address created on Ved Rasic.
with ved as (
  select id from jasonos.contacts where 'ved@leaddelta.com' = any(emails) limit 1
),
bad_titles as (
  select unnest(array[
    'Maryland Product Symposium 2026',
    '2 Hours Workshop: Building an Agentic GTM Engine',
    'Building an Agentic GTM Engine Workshop - Round 2',
    'The Paid Layer of AI Search Has Arrived',
    'The B2B AI Discovery Playbook: Lessons from 380k Answers with Ross Simmonds',
    'Diagnose Before You Pitch: A Discovery Call Workshop for Fractional Leaders',
    'Cracking the Code of Predictable Growth — Live Workshop with Charles Gaudet x LeadDelta',
    'AI Search is Bigger Than SEO',
    'Peec AI: Perspective'
  ]) as title
)
delete from jasonos.meetings m
using ved, bad_titles b
where m.contact_id = ved.id and m.title = b.title;

with ved as (
  select id from jasonos.contacts where 'ved@leaddelta.com' = any(emails) limit 1
)
delete from jasonos.contact_touches t
using ved
where t.contact_id = ved.id
  and t.source = 'gcal'
  and t.brief in (
    'Maryland Product Symposium 2026',
    '2 Hours Workshop: Building an Agentic GTM Engine',
    'Building an Agentic GTM Engine Workshop - Round 2',
    'The Paid Layer of AI Search Has Arrived',
    'The B2B AI Discovery Playbook: Lessons from 380k Answers with Ross Simmonds',
    'Diagnose Before You Pitch: A Discovery Call Workshop for Fractional Leaders',
    'Cracking the Code of Predictable Growth — Live Workshop with Charles Gaudet x LeadDelta',
    'AI Search is Bigger Than SEO',
    'Peec AI: Perspective'
  );

-- Recompute last touch for Ved from what remains.
with ved as (
  select id from jasonos.contacts where 'ved@leaddelta.com' = any(emails) limit 1
),
latest as (
  select t.contact_id, t.touched_at, t.channel
  from jasonos.contact_touches t join ved on t.contact_id = ved.id
  order by t.touched_at desc limit 1
)
update jasonos.contacts c
set last_touch_date = latest.touched_at::date,
    last_touch_channel = latest.channel
from latest
where c.id = latest.contact_id;

-- If nothing remains, clear last touch so the People page does not keep a webinar date.
with ved as (
  select id from jasonos.contacts where 'ved@leaddelta.com' = any(emails) limit 1
)
update jasonos.contacts c
set last_touch_date = null,
    last_touch_channel = null
from ved
where c.id = ved.id
  and not exists (
    select 1 from jasonos.contact_touches t where t.contact_id = ved.id
  );

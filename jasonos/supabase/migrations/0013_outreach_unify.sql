-- 0013_outreach_unify.sql
-- Phase 1 of the Outreach consolidation: lift cadence + classification onto
-- jasonos.contacts as first-class fields so every surface (queue, schedule,
-- people, firms) can read from one source of truth.
--
-- Adds:
--   - jasonos.relationship_type enum (6-bucket: recruiter, hiring_manager,
--     operator_peer, mentor_advisor, prospect, personal)
--   - jasonos.contacts.relationship_type
--   - jasonos.contacts.cadence_interval (text + check constraint)
--   - jasonos.contacts.next_touch_date
--
-- Backfills from:
--   - source_ids.recruiter_pipeline_id  -> relationship_type = 'recruiter'
--   - tag 'role:cold_target'            -> relationship_type = 'prospect'
--   - open cadence_contact cards        -> cadence_interval + next_touch_date
--   - rr_contact_state.next_action_due_date for recruiters -> next_touch_date
--
-- Apply via Supabase Dashboard -> SQL Editor. Do not use `supabase db push`.

-- 1. Relationship-type enum -------------------------------------------------

do $$ begin
  create type jasonos.relationship_type as enum (
    'recruiter',
    'hiring_manager',
    'operator_peer',
    'mentor_advisor',
    'prospect',
    'personal'
  );
exception when duplicate_object then null; end $$;

-- 2. New columns on jasonos.contacts ---------------------------------------

alter table jasonos.contacts
  add column if not exists relationship_type jasonos.relationship_type,
  add column if not exists cadence_interval text,
  add column if not exists next_touch_date  date;

-- cadence_interval is a text column with a check constraint (rather than an
-- enum) so we can evolve the vocabulary without ALTER TYPE.
do $$ begin
  alter table jasonos.contacts
    add constraint contacts_cadence_interval_check
    check (cadence_interval is null or cadence_interval in (
      'weekly', 'biweekly', 'monthly', 'quarterly', 'none'
    ));
exception when duplicate_object then null; end $$;

create index if not exists idx_contacts_next_touch_date
  on jasonos.contacts (next_touch_date)
  where next_touch_date is not null;

create index if not exists idx_contacts_relationship_type
  on jasonos.contacts (relationship_type)
  where relationship_type is not null;

-- 3. Backfill relationship_type --------------------------------------------

-- 3a. Anything with a recruiter_pipeline_id source link is a recruiter.
update jasonos.contacts
   set relationship_type = 'recruiter'
 where relationship_type is null
   and source_ids ->> 'recruiter_pipeline_id' is not null;

-- 3b. Any contact tagged as a cold/outreach target is a prospect.
update jasonos.contacts
   set relationship_type = 'prospect'
 where relationship_type is null
   and tags && array['role:cold_target']::text[];

-- 3c. Cadence-contact tagged rows are left NULL so the user classifies them
--     in the People view in P2 (could be operator_peer or mentor_advisor).
--     We do nothing here on purpose.

-- 4. Backfill cadence_interval + next_touch_date ---------------------------

-- 4a. From open cadence_contact cards (the source the new "+ Add contact"
--     sheet writes to).
update jasonos.contacts c
   set cadence_interval = coalesce(
         nullif(card.body ->> 'cadence_interval', ''),
         'none'
       ),
       next_touch_date  = case
         when card.body ->> 'next_touch_date' ~ '^\d{4}-\d{2}-\d{2}$'
           then (card.body ->> 'next_touch_date')::date
         else null
       end
  from jasonos.cards card
 where card.module = 'reconnect'
   and card.object_type = 'cadence_contact'
   and card.state = 'open'
   and (card.linked_object_ids ->> 'contact_id')::uuid = c.id
   and c.cadence_interval is null;

-- 4b. Recruiters with a manually-scheduled next touch (no cadence rhythm).
update jasonos.contacts c
   set cadence_interval = coalesce(c.cadence_interval, 'none'),
       next_touch_date  = state.next_action_due_date
  from public.rr_contact_state state
 where state.contact_id::text = c.source_ids ->> 'recruiter_pipeline_id'
   and state.next_action_due_date is not null
   and c.next_touch_date is null;

-- 4c. Anyone still NULL gets cadence_interval = 'none' so the default state
--     is explicit (no schedule, no rhythm).
update jasonos.contacts
   set cadence_interval = 'none'
 where cadence_interval is null;

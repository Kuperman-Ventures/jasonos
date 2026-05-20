-- 0017_contact_intent.sql
-- ---------------------------------------------------------------------------
-- Make Intent a first-class state on jasonos.contacts. The Outreach Queue
-- previously derived column membership (Warm / Specific / Cold) from
-- cadence/touch/sequence state; this migration introduces an explicit
-- `intent` column that pins a contact to a column when set.
--
-- A NULL intent means "let the derivation rules decide" — that's the
-- baseline state for everyone today, so nothing is backfilled. The user
-- sets intent explicitly going forward via the redesigned contact card.
--
-- Idempotent and safe to re-run. Apply via Supabase Dashboard -> SQL Editor.
-- ---------------------------------------------------------------------------

set search_path = jasonos, public;

-- 1. Intent enum -----------------------------------------------------------

do $$ begin
  create type jasonos.contact_intent as enum (
    'warm',
    'specific',
    'cold'
  );
exception when duplicate_object then null; end $$;

-- 2. Column on jasonos.contacts -------------------------------------------

alter table jasonos.contacts
  add column if not exists intent jasonos.contact_intent;

-- 3. Index for the queue-buckets read --------------------------------------

create index if not exists idx_contacts_intent
  on jasonos.contacts (intent)
  where intent is not null;

-- 4. NO BACKFILL -----------------------------------------------------------
-- NULL is a valid state ("derivation rules decide"). The user pins intent
-- explicitly via the contact card going forward.

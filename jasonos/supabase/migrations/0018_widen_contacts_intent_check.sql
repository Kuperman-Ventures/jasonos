-- 0018_widen_contacts_intent_check.sql
-- ---------------------------------------------------------------------------
-- Widen the pre-existing CHECK constraint on jasonos.contacts.intent so the
-- new outreach-queue intent values ('warm' | 'specific' | 'cold') can be
-- written from the redesigned contact card alongside the legacy reconnect
-- triage values ('warm' | 'intel' | 'door' | 'pipeline' | 'role_inquiry').
--
-- Why this is needed:
--   `jasonos.contacts.intent` was originally added as a TEXT column with a
--   CHECK constraint locking it to the five legacy reconnect triage values
--   (see lib/triage/types.ts -> `Intent`). That column predates the
--   migration set in this repo (it was added directly to the database).
--
--   Migration 0017_contact_intent.sql tried to introduce an `intent` column
--   typed as the new `jasonos.contact_intent` enum, but it used
--   `add column if not exists`, so the existing TEXT column won and the
--   typed column was never created. The legacy CHECK therefore remained
--   in force.
--
--   Result: writing the new outreach intents 'specific' or 'cold' from
--   setContactIntent (lib/server-actions/outreach.ts) throws
--     "new row for relation \"contacts\" violates check constraint
--      \"contacts_intent_check\""
--   because those values aren't in the legacy allow-list. 'warm' happened to
--   work since it appears in both sets.
--
-- Fix strategy: drop the old constraint, replace it with one whose allow-list
-- is the union of the legacy reconnect triage values AND the new
-- outreach-queue intent values. The column stays TEXT for backwards
-- compatibility with both surfaces; TypeScript-side discriminated unions
-- still enforce per-surface narrowing. NULL stays valid.
--
-- Idempotent and safe to re-run. Apply via Supabase Dashboard -> SQL Editor.
-- ---------------------------------------------------------------------------

set search_path = jasonos, public;

alter table jasonos.contacts
  drop constraint if exists contacts_intent_check;

alter table jasonos.contacts
  add constraint contacts_intent_check
  check (
    intent is null
    or intent in (
      -- New outreach-queue intents (migration 0017 / setContactIntent).
      'warm',
      'specific',
      'cold',
      -- Legacy reconnect triage intents (pre-existing column, still in use
      -- by lib/server-actions/triage.ts -> setContactTriage).
      'intel',
      'door',
      'pipeline',
      'role_inquiry'
    )
  );

-- 0019_add_backrow_intent.sql
-- ---------------------------------------------------------------------------
-- Add a fourth queue-control intent value, 'backrow', alongside the existing
-- outreach-queue intents ('warm' | 'specific' | 'cold') and the legacy
-- reconnect triage intents ('intel' | 'door' | 'pipeline' | 'role_inquiry').
--
-- What 'backrow' means:
--   An explicit user opt-out signal. When intent='backrow', the contact is
--   kept in the database (still visible on /outreach/people) but is removed
--   from the three-column Outreach Queue entirely. It overrides every other
--   queue-classification rule (recent inbound touches, active first-contact
--   sequence, cadence, etc.).
--
-- Why this is a self-contained migration:
--   This migration is intentionally redundant with 0018_widen_contacts_intent_check.sql.
--   It DROPs the current contacts_intent_check (if present) and RE-CREATEs it
--   with the full allow-list — including 'backrow' — so applying just this
--   migration is sufficient even on a database where 0018 was never run.
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
      -- Outreach-queue intents (migration 0017 / setContactIntent).
      'warm',
      'specific',
      'cold',
      -- New: explicit "remove from queue" opt-out (migration 0019).
      'backrow',
      -- Legacy reconnect triage intents (pre-existing column, still in use
      -- by lib/server-actions/triage.ts -> setContactTriage).
      'intel',
      'door',
      'pipeline',
      'role_inquiry'
    )
  );

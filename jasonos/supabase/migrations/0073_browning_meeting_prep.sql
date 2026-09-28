-- Meeting prep built from Tracy's note and the Word resume she attached.
-- Shown on the contact Meetings tab.

set search_path = jasonos, public;

alter table jasonos.contacts
  add column if not exists browning_prep text;

alter table jasonos.browning_handoffs
  add column if not exists meeting_brief text;

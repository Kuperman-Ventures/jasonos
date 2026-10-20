-- Event ids for grey tentative holds placed on Advisors Google Calendar
-- for times offered in a Browning reply. Cleared when the meeting is set.

set search_path = jasonos, public;

alter table jasonos.browning_handoffs
  add column if not exists hold_events jsonb not null default '[]'::jsonb;

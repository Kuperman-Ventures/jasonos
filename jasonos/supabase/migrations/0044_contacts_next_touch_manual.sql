-- 0044_contacts_next_touch_manual.sql
--
-- Distinguish a user-set next-touch date from a cadence-derived one.
-- When next_touch_is_manual is true, queue/schedule urgency uses that date
-- and cadence writes must not overwrite it. When false/null, cadence drives
-- next_touch_date (on cadence change and after a logged touch).

alter table jasonos.contacts
  add column if not exists next_touch_is_manual boolean not null default false;

comment on column jasonos.contacts.next_touch_is_manual is
  'True when the user explicitly set next_touch_date (reschedule / snooze / log override). Cadence recomputes must not overwrite it until the next logged touch or an explicit clear.';

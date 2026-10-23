-- Browning meeting reminders: attendee reminder + Jason RSVP alert.
-- Sent once each when the call is inside the 24-hour window.

set search_path = jasonos, public;

alter table jasonos.browning_handoffs
  add column if not exists attendee_reminder_sent_at timestamptz,
  add column if not exists rsvp_alert_sent_at timestamptz;

comment on column jasonos.browning_handoffs.attendee_reminder_sent_at is
  'When the 24h meeting reminder email was sent to the contact.';
comment on column jasonos.browning_handoffs.rsvp_alert_sent_at is
  'When Jason was emailed that the contact had not accepted the calendar invite.';

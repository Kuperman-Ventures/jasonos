-- Follow-up rows are older Tracy introductions with no calendar meeting.
-- They stay on the waiting list, and Follow Up replies to the last note sent.

set search_path = jasonos, public;

alter table jasonos.browning_handoffs
  add column if not exists last_outreach_subject text,
  add column if not exists last_outreach_sent_at timestamptz;

alter table jasonos.browning_handoffs
  drop constraint if exists browning_handoffs_status_check;

alter table jasonos.browning_handoffs
  add constraint browning_handoffs_status_check check (
    status in (
      'times_ready',
      'draft_ready',
      'acted_on',
      'follow_up',
      'booked',
      'brief_ready',
      'thank_you_ready',
      'dismissed'
    )
  );

-- Acted On means the reply was sent. The handoff stays on the page
-- in the waiting list, and the morning check still looks for the meeting
-- on Google Calendar. The old Dismiss button had been used for that send,
-- so those rows move into the waiting list.

set search_path = jasonos, public;

alter table jasonos.browning_handoffs
  drop constraint if exists browning_handoffs_status_check;

alter table jasonos.browning_handoffs
  add constraint browning_handoffs_status_check check (
    status in (
      'times_ready',
      'draft_ready',
      'acted_on',
      'booked',
      'brief_ready',
      'thank_you_ready',
      'dismissed'
    )
  );

update jasonos.browning_handoffs
  set status = 'acted_on'
  where status = 'dismissed';

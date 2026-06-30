-- 0023_widen_contact_touches_channel.sql
-- ---------------------------------------------------------------------------
-- Add 'call' and 'video' to the allowed jasonos.contact_touches.channel set so
-- the Log a Touch picker can offer Email, LinkedIn, Phone, Text, Call,
-- Video Call, and In Person Meeting. Purely additive; existing values are
-- preserved. Idempotent.
-- ---------------------------------------------------------------------------

alter table jasonos.contact_touches drop constraint if exists contact_touches_channel_check;

alter table jasonos.contact_touches add constraint contact_touches_channel_check
  check (channel = any (array[
    'email','calendar','linkedin','phone','in_person','coffee_chat',
    'text','thank_you_note','value_sharing','other','call','video'
  ]));

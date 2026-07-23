-- Manual reply-status override for contacts.
--
-- The queue/contact reply-status light is normally derived from the last
-- logged communication (inbound = green, recent outbound = yellow, stale
-- outbound = red). Texts aren't tracked, so Jason can pin a status by hand.
-- NULL means "use auto from last logged touch".

alter table jasonos.contacts
  add column if not exists reply_status_override text,
  add column if not exists reply_status_override_at timestamptz;

alter table jasonos.contacts
  drop constraint if exists contacts_reply_status_override_check;

alter table jasonos.contacts
  add constraint contacts_reply_status_override_check
  check (
    reply_status_override is null
    or reply_status_override in ('replied', 'waiting', 'overdue')
  );

comment on column jasonos.contacts.reply_status_override is
  'Manual reply-status light: replied (green), waiting (yellow), overdue (red). NULL = derive from last logged touch.';

comment on column jasonos.contacts.reply_status_override_at is
  'When the manual reply-status override was last set.';

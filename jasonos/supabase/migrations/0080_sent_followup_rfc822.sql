-- RFC 822 Message-ID for Apple Mail message:// deep links.
alter table jasonos.sent_email_followups
  add column if not exists rfc822_message_id text;

comment on column jasonos.sent_email_followups.rfc822_message_id is
  'RFC 822 Message-ID of the outbound send (Apple Mail message:// links).';

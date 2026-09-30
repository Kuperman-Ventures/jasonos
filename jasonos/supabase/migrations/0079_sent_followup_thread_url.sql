-- Deep link for Outlook (and other) sent follow-up rows.
alter table jasonos.sent_email_followups
  add column if not exists thread_url text;

comment on column jasonos.sent_email_followups.thread_url is
  'Provider web link for the sent message/thread (Outlook webLink, etc.).';

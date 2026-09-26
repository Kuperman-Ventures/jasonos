-- Secret token for household iCal subscription feed (Apple Calendar / Google / Outlook).

alter table college.app_state
  add column if not exists calendar_feed_token text;

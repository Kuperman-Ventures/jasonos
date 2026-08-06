-- Beeper Desktop chat sync — track last sync run alongside Gmail / Calendar.
insert into jasonos.outreach_sync_state (source)
values ('beeper')
on conflict do nothing;

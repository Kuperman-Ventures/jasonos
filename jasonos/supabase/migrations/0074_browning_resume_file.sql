-- Where Tracy's Word or PDF resume lives, so the contact page can open it.

set search_path = jasonos, public;

alter table jasonos.browning_handoffs
  add column if not exists resume_message_id text;

alter table jasonos.browning_handoffs
  add column if not exists resume_filename text;

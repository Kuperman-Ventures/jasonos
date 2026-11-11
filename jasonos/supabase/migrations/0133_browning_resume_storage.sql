-- Persist Tracy resume/PDF bytes so prep links do not depend on live Outlook/Gmail.
alter table jasonos.browning_handoffs
  add column if not exists resume_storage_path text;

comment on column jasonos.browning_handoffs.resume_storage_path is
  'Private resumes bucket path for the Word/PDF Tracy attached (browning/{handoffId}/...).';

-- Residency / admit-rate fields for Kyle (NJ resident) vs public vs private schools.
alter table college.schools
  add column if not exists control text not null default '',
  add column if not exists residency_data_status text not null default '',
  add column if not exists kyle_residency text not null default '',
  add column if not exists in_state_admit_rate numeric,
  add column if not exists out_of_state_admit_rate numeric,
  add column if not exists overall_admit_rate numeric,
  add column if not exists rate_that_applies_to_kyle numeric,
  add column if not exists admit_data_year text not null default '',
  add column if not exists enrolled_out_of_state_pct numeric,
  add column if not exists out_of_state_definition text not null default '',
  add column if not exists out_of_state_policy text not null default '',
  add column if not exists engineering_residency_note text not null default '',
  add column if not exists residency_source_url text not null default '',
  add column if not exists residency_notes text not null default '';

alter table college.schools drop constraint if exists schools_control_check;
alter table college.schools
  add constraint schools_control_check
  check (control in ('', 'Public', 'Private'));

alter table college.schools drop constraint if exists schools_residency_data_status_check;
alter table college.schools
  add constraint schools_residency_data_status_check
  check (residency_data_status in ('', 'Official', 'Estimated', 'Proxy', 'Not applicable'));

alter table college.schools drop constraint if exists schools_kyle_residency_check;
alter table college.schools
  add constraint schools_kyle_residency_check
  check (kyle_residency in ('', 'In-state', 'Out-of-state', 'Not applicable'));

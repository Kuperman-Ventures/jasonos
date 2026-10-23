-- Optional company link on a meeting prep (independent of primary contact).
alter table jasonos.meeting_preps
  add column if not exists company_id uuid references jasonos.companies(id) on delete set null;

create index if not exists meeting_preps_company_idx
  on jasonos.meeting_preps (company_id)
  where company_id is not null;

comment on column jasonos.meeting_preps.company_id is
  'Optional company this meeting is about, when not (only) implied by the primary contact.';

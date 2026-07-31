-- 0048_email_templates.sql
-- ---------------------------------------------------------------------------
-- Custom email templates saved from the Email Builder. A good Builder draft
-- can be generalized (recipient first name → {{name}}) and stored here so it
-- shows up alongside the built-in templates for reuse with other contacts.
-- Read/written by JasonOS server actions via the service role.
-- ---------------------------------------------------------------------------

create table if not exists jasonos.email_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  blurb text not null default '',
  subject_template text not null default '',
  body_template text not null,
  source text not null default 'builder',
  created_at timestamptz not null default now()
);

create index if not exists email_templates_created_at_desc_idx
  on jasonos.email_templates (created_at desc);

alter table jasonos.email_templates enable row level security;

-- No anon/authenticated policies: only the service role (JasonOS server) reads
-- and writes. Service role bypasses RLS.

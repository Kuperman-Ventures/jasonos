-- 0024_contact_candidates.sql
-- ---------------------------------------------------------------------------
-- Staging inbox for the "Suggested Contacts" review flow. Every person seen in
-- email (sent or received) who is NOT already in jasonos.contacts gets a row
-- here; the user then Adds (creates a real contact) or Dismisses (permanent
-- ignore) from the Outreach → Suggested tab. Keeps the People list clean —
-- nothing lands in contacts without an explicit Add.
--
-- Access is service-role only (matches sibling jasonos tables); RLS is enabled
-- with no policies so the anon/authenticated roles can't read it.
-- ---------------------------------------------------------------------------

create table if not exists jasonos.contact_candidates (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  company text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  last_subject text,
  inbound_count integer not null default 0,
  outbound_count integer not null default 0,
  status text not null default 'new' check (status in ('new','added','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_candidates_status_idx on jasonos.contact_candidates(status);

alter table jasonos.contact_candidates enable row level security;

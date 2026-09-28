-- Browning Networking: one row per Tracy handoff email.
-- The morning job inserts the row, proposes times, and writes cards.
-- Existing contacts are linked and never updated.

set search_path = jasonos, public;

create table if not exists jasonos.browning_handoffs (
  id uuid primary key default gen_random_uuid(),
  gmail_account text not null,
  gmail_message_id text not null,
  gmail_thread_id text,
  rfc822_message_id text,
  received_at timestamptz,
  subject text,
  contact_name text,
  contact_email text,
  contact_phone text,
  linkedin_url text,
  contact_title text,
  contact_company text,
  availability_note text,
  quoted_reply text,
  why_they_replied text,
  existing_contact_id uuid references jasonos.contacts(id) on delete set null,
  created_contact_id uuid references jasonos.contacts(id) on delete set null,
  slots jsonb not null default '[]'::jsonb,
  draft_body text,
  gmail_draft_id text,
  gmail_draft_url text,
  call_event_id text,
  call_title text,
  call_starts_at timestamptz,
  call_ends_at timestamptz,
  brief jsonb,
  thank_you_body text,
  thank_you_source text,
  card_id uuid references jasonos.cards(id) on delete set null,
  prep_card_id uuid references jasonos.cards(id) on delete set null,
  thanks_card_id uuid references jasonos.cards(id) on delete set null,
  status text not null default 'times_ready',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gmail_account, gmail_message_id),
  constraint browning_handoffs_status_check check (
    status in (
      'times_ready',
      'draft_ready',
      'booked',
      'brief_ready',
      'thank_you_ready',
      'dismissed'
    )
  )
);

create index if not exists idx_browning_handoffs_status
  on jasonos.browning_handoffs (status, created_at desc);

drop trigger if exists set_updated_at on jasonos.browning_handoffs;
create trigger set_updated_at
  before update on jasonos.browning_handoffs
  for each row execute function jasonos.set_updated_at();

alter table jasonos.browning_handoffs enable row level security;

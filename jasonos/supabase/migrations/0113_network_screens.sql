-- Network Screen: a connector's visible LinkedIn connections, scored for intro requests.
-- Service-role only (same arrangement as family meeting / commitment checks).
-- JasonOS does not open LinkedIn and does not send the intro email.

set search_path = jasonos, public;

create table if not exists jasonos.network_screens (
  id uuid primary key default gen_random_uuid(),
  connector_contact_id uuid not null references jasonos.contacts(id) on delete cascade,
  connector_linkedin_url text not null,
  connector_name text not null,
  connector_headline text,
  connector_company text,
  connector_location text,
  connector_degree text,
  partner_note text,
  relationship_warmth text not null default 'new'
    check (relationship_warmth in ('new', 'warm', 'expecting_review')),
  meeting_notes_summary text,
  open_commitments text,
  visible_count integer not null default 0,
  total_count_label text,
  status text not null default 'awaiting_capture'
    check (status in ('awaiting_capture', 'captured', 'scored', 'drafted', 'requested', 'archived')),
  draft_subject text,
  draft_body text,
  requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists jasonos.network_screen_candidates (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references jasonos.network_screens(id) on delete cascade,
  name text not null,
  headline text,
  title text,
  company text,
  location text,
  linkedin_url text,
  linkedin_degree text,
  mutual_connections text,
  bucket text not null default 'unscored'
    check (bucket in ('unscored', 'hiring_path', 'recruiter', 'peer_referral', 'speaking_content', 'not_relevant')),
  tier text not null default 'none'
    check (tier in ('none', 'tier1', 'tier2')),
  why text,
  ask text,
  next_action text,
  queue_status text not null default 'queued'
    check (queue_status in ('queued', 'intro_requested', 'intro_made', 'reached_out_direct', 'hold', 'dropped')),
  intro_requested_at timestamptz,
  contact_id uuid references jasonos.contacts(id) on delete set null,
  scored_by text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists network_screen_candidates_screen_idx
  on jasonos.network_screen_candidates (screen_id, tier, bucket);

create index if not exists network_screen_candidates_queue_idx
  on jasonos.network_screen_candidates (queue_status) where tier = 'tier1';

comment on table jasonos.network_screens is
  'One Network Screen per connector. Claude imports the visible LinkedIn connections; JasonOS scores them and drafts the intro request. Nothing is sent from the app.';

comment on table jasonos.network_screen_candidates is
  'People captured from a connector LinkedIn network. A row becomes a contact only after the intro is made or Jason reaches out directly.';

drop trigger if exists network_screens_set_updated_at on jasonos.network_screens;
create trigger network_screens_set_updated_at
  before update on jasonos.network_screens
  for each row execute function jasonos.set_updated_at();

drop trigger if exists network_screen_candidates_set_updated_at on jasonos.network_screen_candidates;
create trigger network_screen_candidates_set_updated_at
  before update on jasonos.network_screen_candidates
  for each row execute function jasonos.set_updated_at();

alter table jasonos.network_screens enable row level security;
alter table jasonos.network_screen_candidates enable row level security;

revoke all on table jasonos.network_screens from anon, authenticated;
revoke all on table jasonos.network_screen_candidates from anon, authenticated;

grant all on table jasonos.network_screens to service_role;
grant all on table jasonos.network_screen_candidates to service_role;

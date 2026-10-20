-- Browning packet materials on the handoff, prep link, and remove Hold · meetings.
-- 0100 is already used for holds_cleared_at. Service-role only. Safe to re-run.

set search_path = jasonos, public;

alter table jasonos.browning_handoffs
  add column if not exists resume_text text,
  add column if not exists intro_reason text,
  add column if not exists linkedin_urls text[] not null default '{}',
  add column if not exists other_documents jsonb not null default '[]'::jsonb,
  add column if not exists packet_stored_at timestamptz,
  add column if not exists prep_id uuid references jasonos.meeting_preps(id) on delete set null,
  add column if not exists plan_built_at timestamptz;

create index if not exists browning_handoffs_prep_idx
  on jasonos.browning_handoffs (prep_id);

alter table jasonos.meeting_preps
  add column if not exists handoff_id uuid references jasonos.browning_handoffs(id) on delete set null,
  add column if not exists plan_source text,
  add column if not exists packet_highlights text[];

comment on column jasonos.meeting_prep_sources.source_type is
  'gmail | outlook | granola | jasonos_touch | jasonos_meeting | jasonos_research | job_search | calendar | document_link | document | intro_email';

delete from jasonos.meetings where title like 'Hold · %';

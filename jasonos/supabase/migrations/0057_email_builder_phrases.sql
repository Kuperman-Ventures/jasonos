-- 0057_email_builder_phrases.sql
-- ---------------------------------------------------------------------------
-- Global phrase memory for Custom Comms → Email Builder free-text fields
-- (relationship / detail / ask). Jason confirms tags when saving a tip; tips
-- show as tap chips next time (any contact). Service-role only.
-- ---------------------------------------------------------------------------

create table if not exists jasonos.email_builder_phrases (
  id uuid primary key default gen_random_uuid(),
  -- Which Builder field this tip belongs to
  field text not null check (field in ('relationship', 'detail', 'ask')),
  -- Display text inserted when the tip is tapped
  phrase text not null,
  -- Lowercased / collapsed whitespace for uniqueness + search
  phrase_norm text not null,
  -- Structured tags Jason confirmed (e.g. company:outfront, topic:new_role)
  tags text[] not null default '{}',
  use_count integer not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint email_builder_phrases_field_norm_uidx unique (field, phrase_norm)
);

create index if not exists email_builder_phrases_field_last_used_idx
  on jasonos.email_builder_phrases (field, last_used_at desc);

create index if not exists email_builder_phrases_tags_gin_idx
  on jasonos.email_builder_phrases using gin (tags);

alter table jasonos.email_builder_phrases enable row level security;

-- No anon/authenticated policies: only the service role (JasonOS server) reads
-- and writes. Service role bypasses RLS.

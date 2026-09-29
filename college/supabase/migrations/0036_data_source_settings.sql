-- Data Sources settings (AI model) and per-school link-out URL overrides.
alter table college.app_state
  add column if not exists data_source_settings jsonb not null default '{}'::jsonb,
  add column if not exists link_overrides jsonb not null default '{}'::jsonb;

comment on column college.app_state.data_source_settings is
  'Super-admin settings from Reference > Data Sources, e.g. {"aiModel": "google/gemini-2.5-flash"}.';
comment on column college.app_state.link_overrides is
  'Per-school link-out overrides keyed by source id then school id: {"npc": {"mit": "https://..."}, "virtual-tours": {...}}.';

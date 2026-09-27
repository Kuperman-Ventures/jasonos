-- Shared household finances settings (budget + per-school NPC / merit offer).
alter table college.app_state
  add column if not exists finances jsonb not null default '{}'::jsonb;

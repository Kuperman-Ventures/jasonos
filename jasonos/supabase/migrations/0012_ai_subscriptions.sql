-- 0012 — AI Subscription tracking config
-- Stores per-user AI service subscription metadata and manual tracking data
-- in a JSONB column on user_preferences so it's co-located with other prefs.

alter table public.user_preferences
  add column if not exists ai_subscriptions jsonb default '{
    "services": {}
  }'::jsonb;

comment on column public.user_preferences.ai_subscriptions is
  'AI service subscription config: plan tiers, renewal dates, budget limits, and manual usage for services that lack APIs.';

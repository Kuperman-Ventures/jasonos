-- Webinar topics. Sessions and takeaways point at one topic each.
-- Service-role only, same isolation as 0127_webinars.sql.
-- Jason applies this file in the Supabase dashboard SQL editor.

set search_path = jasonos, public;

create table if not exists jasonos.webinar_topics (
  slug text primary key,
  name text not null,
  description text not null default '',
  sort_order int not null default 0,
  status text not null default 'active' check (status in ('active', 'proposed', 'archived')),
  proposed_reason text not null default '',
  merged_into text references jasonos.webinar_topics(slug) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table jasonos.webinar_topics is
  'Controlled topic list for /webinars. Claude may propose a row; Jason accepts or merges it.';

alter table jasonos.webinar_sessions
  add column if not exists topic_slug text references jasonos.webinar_topics(slug) on delete set null;

alter table jasonos.webinar_takeaways
  add column if not exists topic_slug text references jasonos.webinar_topics(slug) on delete set null;

create index if not exists webinar_sessions_topic_idx
  on jasonos.webinar_sessions (topic_slug, session_date desc);

create index if not exists webinar_takeaways_topic_idx
  on jasonos.webinar_takeaways (topic_slug, created_at desc);

drop trigger if exists set_updated_at on jasonos.webinar_topics;
create trigger set_updated_at
  before update on jasonos.webinar_topics
  for each row execute function jasonos.set_updated_at();

alter table jasonos.webinar_topics enable row level security;

revoke all on table jasonos.webinar_topics from anon, authenticated;

grant all on table jasonos.webinar_topics to service_role;

insert into jasonos.webinar_topics (slug, name, description, sort_order, status)
values
  (
    'ai-search-aeo',
    'AI Search and AEO/GEO',
    'How AI answer engines pick, cite and rank sources; AEO and GEO practice',
    10,
    'active'
  ),
  (
    'ai-operating-model',
    'AI Operating Model and Agents',
    'Enterprise AI adoption, agentic marketing, governance, talent and tooling',
    20,
    'active'
  ),
  (
    'measurement-attribution',
    'Marketing Measurement and Attribution',
    'Attribution, incrementality, MMM, AI search measurement',
    30,
    'active'
  ),
  (
    'brand-performance',
    'Brand and Performance',
    'Brand building versus performance marketing and how they combine',
    40,
    'active'
  ),
  (
    'job-search-career',
    'Executive Job Search and Career',
    'Executive search, resumes, networking, career pivots',
    50,
    'active'
  ),
  (
    'advisory-practice',
    'Fractional and Advisory Practice',
    'Business development, pricing, positioning and operations for fractional and advisory work',
    60,
    'active'
  ),
  (
    'product-management',
    'Product Management',
    'Product strategy, discovery, roadmaps and product organizations',
    70,
    'active'
  ),
  (
    'media-ooh',
    'Media and Out-of-Home',
    'Media markets, out-of-home advertising and ad tech',
    80,
    'active'
  )
on conflict (slug) do nothing;

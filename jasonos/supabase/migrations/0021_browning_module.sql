-- 0021_browning_module.sql
-- ---------------------------------------------------------------------------
-- Browning Associates engagement module.
--
-- Adds two classification columns to jasonos.contacts and three new tables:
--   jasonos.browning_conversations  -- 5-dimension scored conversation log
--   jasonos.browning_gates          -- the 11-step Action Plan progress tracker
--   jasonos.browning_deliverables   -- monthly accountability vs. what Browning promised
--
-- Plus one view for weekly KPI rollups consumed by the home dashboard card.
--
-- Idempotent. Apply via Supabase Dashboard -> SQL Editor.
-- ---------------------------------------------------------------------------

set search_path = jasonos, public;

-- 1. Contact classification ------------------------------------------------

alter table jasonos.contacts
  add column if not exists browning_source text;

alter table jasonos.contacts
  add column if not exists browning_tier smallint;

do $$ begin
  alter table jasonos.contacts
    add constraint contacts_browning_source_check
    check (browning_source is null or browning_source in ('my_list','browning_referral'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table jasonos.contacts
    add constraint contacts_browning_tier_check
    check (browning_tier is null or (browning_tier between 1 and 4));
exception when duplicate_object then null; end $$;

create index if not exists idx_contacts_browning_source
  on jasonos.contacts (browning_source)
  where browning_source is not null;

-- 2. Scored conversation log -----------------------------------------------

create table if not exists jasonos.browning_conversations (
  id                      uuid primary key default gen_random_uuid(),
  contact_id              uuid not null references jasonos.contacts(id) on delete cascade,
  linked_touch_id         uuid references jasonos.contact_touches(id) on delete set null,
  conversation_date       date not null,
  channel                 text not null,
  duration_min            int,
  -- Five-dimension self-score (1-5). NOT NULL — if a conversation row exists, it has been scored.
  warmth                  smallint not null,
  patience                smallint not null,
  advice_mode             smallint not null,
  two_referral_ask        smallint not null,
  reciprocity             smallint not null,
  referrals_received      smallint not null default 0,
  thank_you_sent          text not null default 'pending',
  what_was_hard           text,
  what_to_do_differently  text,
  produced_lead           boolean not null default false,
  scored_at               timestamptz not null default now(),
  inserted_at             timestamptz not null default now(),
  -- Generated column: average of the 5 dimensions, for fast read paths.
  avg_quality             numeric(3,2) generated always as (
    ((warmth + patience + advice_mode + two_referral_ask + reciprocity)::numeric) / 5.0
  ) stored
);

do $$ begin
  alter table jasonos.browning_conversations
    add constraint browning_conversations_channel_check
    check (channel in ('phone','video','in_person','email','linkedin'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table jasonos.browning_conversations
    add constraint browning_conversations_warmth_check check (warmth between 1 and 5);
  alter table jasonos.browning_conversations
    add constraint browning_conversations_patience_check check (patience between 1 and 5);
  alter table jasonos.browning_conversations
    add constraint browning_conversations_advice_mode_check check (advice_mode between 1 and 5);
  alter table jasonos.browning_conversations
    add constraint browning_conversations_two_referral_ask_check check (two_referral_ask between 1 and 5);
  alter table jasonos.browning_conversations
    add constraint browning_conversations_reciprocity_check check (reciprocity between 1 and 5);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table jasonos.browning_conversations
    add constraint browning_conversations_thank_you_check
    check (thank_you_sent in ('yes','no','pending'));
exception when duplicate_object then null; end $$;

create index if not exists idx_browning_conversations_contact_id
  on jasonos.browning_conversations (contact_id, conversation_date desc);
create index if not exists idx_browning_conversations_date
  on jasonos.browning_conversations (conversation_date desc);
create unique index if not exists uniq_browning_conversations_linked_touch
  on jasonos.browning_conversations (linked_touch_id)
  where linked_touch_id is not null;

-- 3. Action plan gates -----------------------------------------------------

create table if not exists jasonos.browning_gates (
  gate_code        text primary key,
  step_number      smallint not null,
  description      text not null,
  browning_sla     text,
  target_date      date,
  completed_date   date,
  status           text not null default 'not_started',
  notes            text,
  updated_at       timestamptz not null default now()
);

do $$ begin
  alter table jasonos.browning_gates
    add constraint browning_gates_status_check
    check (status in ('not_started','in_progress','blocked_browning','blocked_me','completed'));
exception when duplicate_object then null; end $$;

-- Seed the 11 gates idempotently.
insert into jasonos.browning_gates (gate_code, step_number, description, browning_sla) values
  ('1A', 1, 'Data Dump — list of 200+ names (300+ stretch)',              'Self-driven; PM reviews'),
  ('1B', 1, 'Categorize list into 3-4 relationship tiers',                 'Self-driven; PM reviews'),
  ('1C', 1, 'Draft outreach template letter',                              'PM coaches the message'),
  ('1D', 1, 'Message coaching session with PM',                            'PM-led; voice/tone refined'),
  ('2A', 2, 'First 10 outreach calls (people I know)',                     'Self-driven; debrief with PM'),
  ('2B', 2, 'Browning begins feeding referrals (1-2 at a time)',           'Browning-driven'),
  ('2C', 2, 'Roundtable review with senior consultant',                    'Browning-driven'),
  ('3A', 3, 'Career assessment / dev docs submitted to Browning',          'Self-driven; required to start 3B'),
  ('3B', 3, 'Resume + executive biography delivered',                      '21-day SLA from Browning after 3A'),
  ('3C', 3, 'LinkedIn + social media redev complete',                      'Browning-driven'),
  ('3D', 3, 'Coaching on application strategy for posted roles',          'Browning-driven')
on conflict (gate_code) do nothing;

-- 4. Monthly deliverables log ---------------------------------------------

create table if not exists jasonos.browning_deliverables (
  id                uuid primary key default gen_random_uuid(),
  month             date not null,                 -- first of the month
  promised          text not null,
  delivered_status  text,
  on_time           boolean,
  quality           smallint,
  notes             text,
  escalate          boolean not null default false,
  inserted_at       timestamptz not null default now()
);

do $$ begin
  alter table jasonos.browning_deliverables
    add constraint browning_deliverables_delivered_status_check
    check (delivered_status is null or delivered_status in ('yes_on_time','yes_late','partial','no','na'));
  alter table jasonos.browning_deliverables
    add constraint browning_deliverables_quality_check
    check (quality is null or (quality between 1 and 5));
exception when duplicate_object then null; end $$;

create index if not exists idx_browning_deliverables_month
  on jasonos.browning_deliverables (month desc);

-- 5. Weekly KPI rollup view ------------------------------------------------

create or replace view jasonos.browning_weekly_kpis as
select
  date_trunc('week', conversation_date)::date + 4 as week_ending_friday,
  count(*)                                         as conversations_count,
  avg(warmth)::numeric(3,2)                        as avg_warmth,
  avg(avg_quality)::numeric(3,2)                   as avg_quality_overall,
  sum(referrals_received)                          as referrals_received_total,
  sum(case when thank_you_sent = 'yes' then 1 else 0 end) as thank_yous_sent_count,
  sum(case when produced_lead    then 1 else 0 end) as leads_produced_count
from jasonos.browning_conversations
group by 1
order by 1 desc;

-- 6. RLS — match the rest of the jasonos schema (single-user app, owner role only) ----------
-- (Skipped here; defer to existing schema-level RLS policy patterns.)

-- Narratives Jason edits, company research, and the Advisors Intro strategy.
-- Service-role only. Safe to re-run. Seeded narrative bodies fill only when empty.
-- Re-running the strategy seed replaces Advisors Intro items and leaves every other strategy alone.

set search_path = jasonos, public;

create table if not exists jasonos.narratives (
  key text primary key,
  title text not null,
  body text not null default '',
  tracks jasonos.track[] not null default '{}',
  updated_at timestamptz not null default now()
);

comment on table jasonos.narratives is
  'Named text blocks the meeting drafter receives when the meeting track matches.';

alter table jasonos.narratives enable row level security;
revoke all on table jasonos.narratives from anon, authenticated;

insert into jasonos.narratives (key, title, tracks) values
  ('about_me', 'About me', '{job_search,advisors,venture}'),
  ('kuperman_advisors', 'Kuperman Advisors', '{advisors}'),
  ('agencytoolbox', 'AgencyToolBox.ai', '{advisors,venture}'),
  ('refactor_sprint', 'Refactor Sprint', '{advisors}'),
  ('gtmtools', 'GTMTools', '{venture}'),
  ('job_search_positioning', 'What I am looking for', '{job_search}')
on conflict (key) do nothing;

update jasonos.narratives n
  set body = coalesce((select about_jason from public.user_preferences where about_jason is not null and length(trim(about_jason)) > 0 limit 1), ''),
      updated_at = now()
where n.key = 'about_me' and n.body = '';

update jasonos.narratives
  set body = $body$Fractional CMO engagements with B2B SaaS / AdTech / RMN scale-ups, $2-50M ARR.$body$,
      updated_at = now()
where key = 'kuperman_advisors' and body = '';

update jasonos.narratives
  set body = $body$Refactor Sprint: 72-hour AI-augmented GTM diagnostic, $2,500 fixed fee, 45+ completed.
ICP: B2B SaaS/Tech/Fintech, Series A-B, CRM with 12+ months data, $20k+/mo marketing spend, sales/marketing disconnect.
Not a fit for: pre-revenue, sub-$2M ARR, transactional SMB, commodity, no CRM data.
Positioning frame: disqualification. $2,500 to save the $50,000 you are about to waste. Cost of waiting over feature selling.$body$,
      updated_at = now()
where key = 'refactor_sprint' and body = '';

-- JASON_IDENTITY's current-work block does not describe AgencyToolBox.ai.
-- The card stays editable and is not left blank.
update jasonos.narratives
  set body = $body$AgencyToolBox.ai. The identity file does not describe this product yet. Edit this card before a call that needs the story of how it came to be.$body$,
      updated_at = now()
where key = 'agencytoolbox' and body = '';

alter table jasonos.companies
  add column if not exists description text,
  add column if not exists research_brief text,
  add column if not exists research_at timestamptz,
  add column if not exists website text;

comment on column jasonos.companies.research_brief is
  'Who the company is and how it makes money. Written by meeting research, not by hand.';

alter table jasonos.meeting_preps
  add column if not exists track jasonos.track,
  add column if not exists research_ran_at timestamptz,
  add column if not exists email_context text,
  add column if not exists email_context_at timestamptz;

comment on column jasonos.meeting_preps.email_context is
  'Summary of the email threads that produced this meeting. Built at draft time. Not stored as touches.';

select jasonos.seed_live_strategy(
  'Advisors Intro - First Call',
  $desc$First conversation with a business contact who may become a client, partner or collaborator for Kuperman Advisors or AgencyToolBox.ai.$desc$,
  $sit$A first call with someone I have not worked with, where I need to explain who I am and what I do, learn what they are building, and find out whether there is a reason to talk again.$sit$,
  $suc$I learn what {{name}} is building and what they need, I explain Kuperman Advisors and AgencyToolBox.ai in under three minutes combined, and we agree on a specific next step.$suc$,
  $rub$["Asked what they are building before explaining what I do","Gave the background in under 60 seconds","Explained Kuperman Advisors in one minute with one client example","Explained AgencyToolBox.ai in one minute with how it came to be","Asked what they need right now","Named one way I could help them","Agreed on a next step with a date"]$rub$::jsonb,
  $src$Jason's narratives (Settings) and the Browning "ask first" rule.$src$,
  $items$[
    {"kind":"agenda","headline":"Open","detail":null,"prepare_reactions":false,"reactions":[]},
    {"kind":"question","headline":"What is {{company}} building right now?","detail":"Before I go through my background, tell me what you are working on and what prompted this call.","prepare_reactions":false,"reactions":[]},
    {"kind":"agenda","headline":"Who I am","detail":null,"prepare_reactions":false,"reactions":[]},
    {"kind":"point","headline":"60-second background","detail":"{{snapshot}}","prepare_reactions":false,"reactions":[]},
    {"kind":"point","headline":"Kuperman Advisors","detail":"{{narrative:kuperman_advisors}}","prepare_reactions":false,"reactions":[]},
    {"kind":"point","headline":"AgencyToolBox.ai and how it came to be","detail":"{{narrative:agencytoolbox}}","prepare_reactions":false,"reactions":[]},
    {"kind":"agenda","headline":"Where this could go","detail":null,"prepare_reactions":false,"reactions":[]},
    {"kind":"question","headline":"What do you need right now?","detail":"What is the thing you are trying to solve this quarter that you do not have the right person for?","prepare_reactions":false,"reactions":[]},
    {"kind":"point","headline":"One way I could help","detail":"Name the one thing from the conversation where my work fits. One sentence. Do not pitch a second thing.","prepare_reactions":false,"reactions":[]},
    {"kind":"ask","headline":"What is the right next step?","detail":"Is there a reason for a second conversation, and what should it be: a working session, an intro to someone on your team, or a proposal?","prepare_reactions":true,"reactions":[
      {"shape":"agree","soundsLike":"Yes. Let's book a working session.","pivot":"I'll send two times today. What should we walk through?"},
      {"shape":"soft_agree","soundsLike":"That could be useful. Let me think on it.","pivot":"I'll send a note today with the one thing we named, and a time next week."},
      {"shape":"defer","soundsLike":"I'm buried this month.","pivot":"Understood. I'll send the note today and a time for later."},
      {"shape":"deflect","soundsLike":"You should talk to my head of growth.","pivot":"Will you introduce us? I'll send a short note they can read first."},
      {"shape":"counter_ask","soundsLike":"What does working together look like?","pivot":"A working session first. If that is useful, we talk about a scope."},
      {"shape":"decline","soundsLike":"I don't think we need this.","pivot":"Fair. If that problem comes back, the note I send today is enough to restart."}
    ]},
    {"kind":"agenda","headline":"Close","detail":null,"prepare_reactions":false,"reactions":[]},
    {"kind":"point","headline":"Confirm the date","detail":"Put the next step on the calendar before we hang up. I will send a note today with what we agreed.","prepare_reactions":false,"reactions":[]}
  ]$items$::jsonb
);

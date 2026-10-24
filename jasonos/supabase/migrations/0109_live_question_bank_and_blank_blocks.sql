-- The full 4 Topics question bank, and Blank blocks for playbooks and sheets that have none.
-- Safe to re-run. Rapport and turn_to_me questions and anything Jason added stay.

set search_path = jasonos, public;

-- The 0108 seed rows for the four topics give way to the full list.
delete from jasonos.playbook_questions
where playbook_id is null
  and (
    source in ('The 4 Topics', 'Communications Handbook')
    or (
      topic in ('industry', 'company', 'contacts', 'resources')
      and source in (
        'Networking 102',
        'Networking 102 (2nd Call)',
        'The Ask and Why',
        'Browning coaching call, Jul 15 2026',
        'Jason''s original Browning points'
      )
    )
  );

with seed(topic, text, source, position) as (
  values
    ('industry', 'What are some of the biggest challenges affecting this industry?', 'The 4 Topics', 1),
    ('industry', 'Are you seeing a slowdown in the industry?', 'The 4 Topics', 2),
    ('industry', 'Given my skill set, can you suggest other potential industry pivots?', 'The 4 Topics', 3),
    ('industry', 'How is AI affecting our industry?', 'The 4 Topics', 4),
    ('industry', 'What skills do I need to acquire to successfully transition into this industry?', 'The 4 Topics', 5),
    ('industry', 'Will I likely have to start at a lower level or take a step back in this transition?', 'The 4 Topics', 6),
    ('industry', 'How can I meet the right people in this new industry?', 'The 4 Topics', 7),
    ('industry', 'At what level do you envision someone with my background starting out in this industry?', 'The 4 Topics', 8),
    ('industry', 'Are you aware of companies looking to diversify their talent pool by looking outside their traditional industry?', 'The 4 Topics', 9),
    ('industry', 'Are you aware of companies looking to change the landscape of their workforce?', 'The 4 Topics', 10),
    ('industry', 'How did you change industries?', 'The 4 Topics', 11),

    ('company', 'What are your company''s biggest challenges right now?', 'The 4 Topics', 1),
    ('company', 'Are you aware of any high-growth technology companies, and do you have connections within them?', 'The 4 Topics', 2),
    ('company', 'I see you used to work at X company; are you still connected to anyone there?', 'The 4 Topics', 3),
    ('company', 'Are you aware of any mergers and acquisitions?', 'The 4 Topics', 4),
    ('company', 'Are you aware of any notable startups?', 'The 4 Topics', 5),
    ('company', 'Are you aware of any companies currently in transition?', 'The 4 Topics', 6),
    ('company', 'Are you aware of any companies looking to digitally transform their operations platform?', 'The 4 Topics', 7),
    ('company', 'Are you aware of any companies facing significant challenges that may require turnaround efforts?', 'The 4 Topics', 8),
    ('company', 'Are you familiar with any companies seeking interim or fractional CEOs?', 'The 4 Topics', 9),
    ('company', 'Should I be targeting small or large firms right now?', 'The 4 Topics', 10),
    ('company', 'Are there any companies not on my current target list that you would recommend?', 'The 4 Topics', 11),
    ('company', 'Do you see someone with my skills fitting into your company? If so, at what level and in what role?', 'The 4 Topics', 12),
    ('company', 'How do people typically get hired at your company?', 'The 4 Topics', 13),

    ('contacts', 'I noticed on your LinkedIn profile you''re connected to X at ABC Co. How well do you know them?', 'The 4 Topics', 1),
    ('contacts', 'Do you know people at an executive level who possess deep social or professional networks?', 'The 4 Topics', 2),
    ('contacts', 'Are you connected to anyone in manufacturing, software, or IT?', 'The 4 Topics', 3),
    ('contacts', 'Are there any executives on LinkedIn you recommend I connect with?', 'The 4 Topics', 4),
    ('contacts', 'Who in your network would you consider the most connected?', 'The 4 Topics', 5),
    ('contacts', 'Who would you identify as captains of industry or influencers within your network?', 'The 4 Topics', 6),
    ('contacts', 'Are you connected to any individuals serving on company boards?', 'The 4 Topics', 7),
    ('contacts', 'Are you connected to any private equity or venture capital professionals?', 'The 4 Topics', 8),
    ('contacts', 'If you had my background and were in career transition, who is the one person you would want to reach out to?', 'The 4 Topics', 9),
    ('contacts', 'What do you see as my most valuable transferable skills in today''s market?', 'Communications Handbook', 10),
    ('contacts', 'Which industries are currently growing?', 'Communications Handbook', 11),
    ('contacts', 'What companies would you recommend targeting?', 'Communications Handbook', 12),
    ('contacts', 'Do you know anyone at those companies?', 'Communications Handbook', 13),
    ('contacts', 'Could you provide a personal introduction for insight?', 'Communications Handbook', 14),
    ('contacts', 'Here is my target company list; which would you focus on?', 'Communications Handbook', 15),

    ('resources', 'What do you love about your job?', 'The 4 Topics', 1),
    ('resources', 'What is the next career move for you?', 'The 4 Topics', 2),
    ('resources', 'Are you happy doing what you are doing now?', 'The 4 Topics', 3),
    ('resources', 'Did you always want to be a [their profession]?', 'The 4 Topics', 4),
    ('resources', 'How did you get into [their industry]?', 'The 4 Topics', 5),
    ('resources', 'How do you like living in [their city]?', 'The 4 Topics', 6),
    ('resources', 'What do you do outside of work to decompress?', 'The 4 Topics', 7),
    ('resources', 'How did you advance so quickly in your career?', 'The 4 Topics', 8),
    ('resources', 'Have you ever mentored someone in their career?', 'The 4 Topics', 9),
    ('resources', 'How did you land this job?', 'The 4 Topics', 10),
    ('resources', 'What tools or resources do you find most helpful when searching for opportunities?', 'The 4 Topics', 11),
    ('resources', 'Are there any recruiters you recommend?', 'The 4 Topics', 12),
    ('resources', 'Can you recommend any networking events?', 'The 4 Topics', 13),
    ('resources', 'How do I find consulting opportunities?', 'The 4 Topics', 14),
    ('resources', 'How do I find interim or fractional CEO roles?', 'The 4 Topics', 15),
    ('resources', 'Are you aware of any resources to find startups, accelerators, or incubators?', 'The 4 Topics', 16),
    ('resources', 'What can I do to elevate my professional visibility?', 'The 4 Topics', 17),
    ('resources', 'Are you part of any online communities or groups that could help increase my visibility?', 'The 4 Topics', 18),
    ('resources', 'How do you read my experiences and accomplishments, and what industries or companies do you think they apply to?', 'The 4 Topics', 19),
    ('resources', 'Have you had a chance to review my background?', 'The 4 Topics', 20),
    ('resources', 'Are you aware of companies that tend to hire consultants or freelance people?', 'The 4 Topics', 21),
    ('resources', 'Are you aware of any resources to make me more visible to consulting or freelance work?', 'The 4 Topics', 22),
    ('resources', 'Where is the best place to find interim leadership roles?', 'The 4 Topics', 23)
),
matched as (
  update jasonos.playbook_questions q
  set topic = seed.topic, source = seed.source, position = seed.position
  from seed
  where q.playbook_id is null and q.text = seed.text
  returning q.text
)
insert into jasonos.playbook_questions (topic, text, spoken, source, position)
select seed.topic, seed.text, null, seed.source, seed.position
from seed
where seed.text not in (select text from matched)
  and not exists (
    select 1 from jasonos.playbook_questions q where q.playbook_id is null and q.text = seed.text
  );

-- Blank's blocks for every playbook or sheet that has none. Existing items stay as the points.
create or replace function pg_temp.blank_blocks()
returns jsonb language sql as $$
  select coalesce(
    (select blocks from jasonos.live_scripts
     where name = 'Blank' and kind = 'strategy' and jsonb_array_length(blocks) > 0
     limit 1),
    $j$[
      {"key":"who","title":"Who","kind":"text","required":false,"default":null,"rule":"Who this is and why now."},
      {"key":"custom:what_i_want","title":"What I want from this call","kind":"text","required":true,"default":null,"rule":"One sentence. You score the call against it."},
      {"key":"points","title":"Points","kind":"points","required":false,"default":null,"rule":null},
      {"key":"close","title":"Close","kind":"text","required":false,"default":null,"rule":"A next step with a date."},
      {"key":"after","title":"After","kind":"after","required":false,"default":null,"rule":"Thank-you within 24 hours."}
    ]$j$::jsonb
  )
$$;

drop table if exists pg_temp.blank_filled;
create temp table blank_filled as
with filled as (
  update jasonos.live_scripts
  set blocks = pg_temp.blank_blocks(), updated_at = now()
  where (blocks is null or blocks = '[]'::jsonb)
    and kind in ('strategy', 'plan')
  returning id
)
select id from filled;

insert into jasonos.call_sheet_blocks (sheet_id, position, key, title, kind, required, body, lines, rule)
select
  s.id,
  b.ordinality::int,
  b.block->>'key',
  b.block->>'title',
  b.block->>'kind',
  coalesce((b.block->>'required')::boolean, false),
  case
    when b.block->>'kind' in ('lines', 'points') then null
    when jsonb_typeof(b.block->'default') = 'string' then nullif(btrim(b.block->>'default'), '')
    else null
  end,
  case
    when b.block->>'kind' = 'lines' and jsonb_typeof(b.block->'default') = 'array' then b.block->'default'
    else '[]'::jsonb
  end,
  b.block->>'rule'
from jasonos.live_scripts s
cross join lateral jsonb_array_elements(s.blocks) with ordinality as b(block, ordinality)
where s.id in (select id from blank_filled)
  and s.kind = 'plan'
  and s.attached_prep_id is null
  and jsonb_array_length(s.blocks) > 0
  and not exists (select 1 from jasonos.call_sheet_blocks c where c.sheet_id = s.id);

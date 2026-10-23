-- Playbooks as data: family, blocks, time budget, objections, and the shared question bank.
-- Default text is recorded in docs/strategies/browning-playbooks.md.
-- Safe to re-run. Points (live_script_items) are written only when a playbook has none,
-- so a re-run keeps edited points. Blocks and objections are replaced by the seed.

set search_path = jasonos, public;

create or replace function jasonos.seed_live_strategy(
  p_name text, p_description text, p_situation text, p_success text,
  p_rubric jsonb, p_source text, p_items jsonb,
  p_family text, p_blocks jsonb, p_time_budget jsonb, p_objections jsonb
) returns uuid language plpgsql set search_path = jasonos, public as $$
declare v_id uuid;
begin
  insert into jasonos.live_scripts (
    name, kind, description, situation, success_sentence, rubric, methodology_source,
    family, blocks, time_budget, objections
  )
  values (
    p_name, 'strategy', p_description, p_situation, p_success, coalesce(p_rubric, '[]'::jsonb), p_source,
    coalesce(p_family, 'custom'), coalesce(p_blocks, '[]'::jsonb), p_time_budget, coalesce(p_objections, '[]'::jsonb)
  )
  on conflict (name) do update set
    description = coalesce(p_description, live_scripts.description),
    situation = coalesce(p_situation, live_scripts.situation),
    success_sentence = coalesce(p_success, live_scripts.success_sentence),
    rubric = coalesce(p_rubric, live_scripts.rubric),
    methodology_source = coalesce(p_source, live_scripts.methodology_source),
    family = excluded.family,
    blocks = excluded.blocks,
    time_budget = excluded.time_budget,
    objections = excluded.objections,
    updated_at = now()
  returning id into v_id;
  -- Null items leaves the playbook's points alone.
  if p_items is not null then
    delete from jasonos.live_script_items where script_id = v_id;
    insert into jasonos.live_script_items (script_id, position, kind, headline, detail, prepare_reactions, reactions)
    select v_id, (ordinality)::int, item->>'kind', item->>'headline', item->>'detail',
           coalesce((item->>'prepare_reactions')::boolean, false), coalesce(item->'reactions', '[]'::jsonb)
    from jsonb_array_elements(p_items) with ordinality as t(item, ordinality);
  end if;
  return v_id;
end $$;

create or replace function jasonos.seed_live_strategy(
  p_name text, p_description text, p_situation text, p_success text,
  p_rubric jsonb, p_source text, p_items jsonb
) returns uuid language sql set search_path = jasonos, public as $$
  select jasonos.seed_live_strategy(
    p_name, p_description, p_situation, p_success, p_rubric, p_source, p_items,
    'custom'::text, '[]'::jsonb, null::jsonb, '[]'::jsonb
  );
$$;

revoke all on function jasonos.seed_live_strategy(text, text, text, text, jsonb, text, jsonb)
  from public, anon, authenticated;
revoke all on function jasonos.seed_live_strategy(text, text, text, text, jsonb, text, jsonb, text, jsonb, jsonb, jsonb)
  from public, anon, authenticated;

-- Short display names. References in code use these.
update jasonos.live_scripts set name = 'Net 102 First Call', updated_at = now()
where name = 'Browning Networking - First Call'
  and not exists (select 1 from jasonos.live_scripts where name = 'Net 102 First Call');
update jasonos.live_scripts set name = 'Net 102 Second Call', updated_at = now()
where name = 'Browning Networking - Second Call'
  and not exists (select 1 from jasonos.live_scripts where name = 'Net 102 Second Call');
update jasonos.live_scripts set name = 'Advisors Intro', updated_at = now()
where name = 'Advisors Intro - First Call'
  and not exists (select 1 from jasonos.live_scripts where name = 'Advisors Intro');

create or replace function pg_temp.items_unless_present(p_name text, p_items jsonb)
returns jsonb language sql as $$
  select case when exists (
    select 1
    from jasonos.live_script_items i
    join jasonos.live_scripts s on s.id = i.script_id
    where s.name = p_name
  ) then null else p_items end
$$;

-- The Browning ten-block template. d overrides each block's default by key.
create or replace function pg_temp.browning_blocks(d jsonb)
returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object(
      'key', 'who', 'title', 'Who', 'kind', 'text', 'required', false,
      'default', d->'who',
      'rule', 'Read their resume. Find one accomplishment to ask about.'),
    jsonb_build_object(
      'key', 'why', 'title', 'Why', 'kind', 'lines', 'required', true,
      'default', coalesce(d->'why', $j$[
        {"label":"Why this person","text":""},
        {"label":"Why someone in their network","text":""},
        {"label":"Why are we talking again","text":""}
      ]$j$::jsonb),
      'rule', 'Answer the whys before you pick up the phone.'),
    jsonb_build_object(
      'key', 'what_how', 'title', 'What and how', 'kind', 'lines', 'required', true,
      'default', coalesce(d->'what_how', $j$[
        {"label":"What I hope to learn","text":""},
        {"label":"How they can help me","text":""},
        {"label":"How I can help them","text":""}
      ]$j$::jsonb),
      'rule', 'Give before getting. Offer help before asking.'),
    jsonb_build_object(
      'key', 'expectations', 'title', 'Set expectations', 'kind', 'text', 'required', false,
      'default', d->'expectations',
      'rule', 'Two minutes. Say what you hope to cover and how long you have.'),
    jsonb_build_object(
      'key', 'rapport', 'title', 'Rapport', 'kind', 'lines', 'required', false,
      'default', coalesce(d->'rapport', $j$[
        {"label":"Compliment","text":""},
        {"label":"Common ground","text":""},
        {"label":"Attention getter","text":""}
      ]$j$::jsonb),
      'rule', 'Five minutes. Genuine and specific.'),
    jsonb_build_object(
      'key', 'conversation', 'title', 'The conversation', 'kind', 'points', 'required', false,
      'default', null,
      'rule', 'Twenty minutes. 80 percent questions. The four topics.'),
    jsonb_build_object(
      'key', 'turn_to_me', 'title', 'Turn to me', 'kind', 'lines', 'required', false,
      'default', coalesce(d->'turn_to_me', $j$[
        {"label":"Profile check","text":"Have you had a chance to look at my executive profile? If not, I'd appreciate it when you get a chance."},
        {"label":"Snapshot","text":"{{snapshot}} Target companies: {{targets}}."},
        {"label":"If asked \"are you looking\"","text":"Don't say \"I'm looking for a job.\" Now: [what I'm doing]. Next: [the seat I want]. Why: [why I'm right for it]."}
      ]$j$::jsonb),
      'rule', 'Have you looked at my profile? Then the snapshot, under 60 seconds.'),
    jsonb_build_object(
      'key', 'ask', 'title', 'The ask', 'kind', 'ask', 'required', false,
      'default', d->'ask',
      'rule', 'Who questions, not if questions. Specific, benefit, compelling.'),
    jsonb_build_object(
      'key', 'close', 'title', 'Close', 'kind', 'text', 'required', false,
      'default', d->'close',
      'rule', 'Three minutes. A date, and "I''ll send a calendar invite."'),
    jsonb_build_object(
      'key', 'after', 'title', 'After', 'kind', 'after', 'required', false,
      'default', coalesce(d->'after', to_jsonb('Thank you for the time today. We covered [topics]. I''m going to [actions]. You mentioned you''d [reminder]. Here''s [something that helps them].'::text)),
      'rule', 'Thank-you within 24 hours: thanks, topics, actions, reminders, something that helps them.')
  )
$$;

create or replace function pg_temp.browning_budget()
returns jsonb language sql as $$
  select '{"expectations":2,"rapport":5,"main":20,"close":3}'::jsonb
$$;

-- Objection sets reused across playbooks (pivots from 0096 and 0098).
create or replace function pg_temp.objections_circle_back()
returns jsonb language sql as $$
  select $j$[
    {"shape":"agree","soundsLike":"Sure, send me an invite.","pivot":"Great. I'll send it for [day] at [time]. I'll have a couple of names for you by then."},
    {"shape":"soft_agree","soundsLike":"Yeah, let's stay in touch.","pivot":"Let's put something on the calendar so it actually happens. Does the week of the [date] work?"},
    {"shape":"defer","soundsLike":"I'm swamped the next few weeks.","pivot":"Understood. I'll send a note in three weeks with a couple of times. Is email the best way to reach you?"},
    {"shape":"deflect","soundsLike":"You should really talk to my colleague about this.","pivot":"I'd like that. Would you be willing to introduce us? And I'd still like to keep our line open."},
    {"shape":"counter_ask","soundsLike":"What exactly are you hoping I can do?","pivot":"Two things. Help me understand what's going on at {{targets}}, and let me help you with anyone you're trying to reach."},
    {"shape":"decline","soundsLike":"I don't think I'm the right person to help.","pivot":"That's fair. Can I at least stay connected on LinkedIn and send you anything useful I come across?"}
  ]$j$::jsonb
$$;

create or replace function pg_temp.objections_radar()
returns jsonb language sql as $$
  select $j$[
    {"shape":"agree","soundsLike":"A couple of people come to mind.","pivot":"Who are they, and would you be comfortable with me mentioning your name?"},
    {"shape":"soft_agree","soundsLike":"Let me think about it and get back to you.","pivot":"Thank you. I'll follow up in my thank-you note so it's easy to reply to."},
    {"shape":"defer","soundsLike":"Let's talk again once I know you better.","pivot":"That makes sense. That's exactly why I want the second call."},
    {"shape":"deflect","soundsLike":"My network is mostly in [other industry].","pivot":"That's fine. We're not competing. Who in that industry knows people in mine?"},
    {"shape":"counter_ask","soundsLike":"What companies are you targeting?","pivot":"{{targets}}. Who do you know that knows someone at any of those?"},
    {"shape":"decline","soundsLike":"I don't really know anyone who's hiring.","pivot":"I'm not looking for people who are hiring. I'm looking for people worth knowing. Who's the most connected person in your network?"}
  ]$j$::jsonb
$$;

create or replace function pg_temp.objections_named_person()
returns jsonb language sql as $$
  select $j$[
    {"shape":"agree","soundsLike":"I know them well. I'll make an intro.","pivot":"Thank you. I'll send you two sentences you can forward so it's easy."},
    {"shape":"soft_agree","soundsLike":"I can probably do that at some point.","pivot":"Would it be too much to ask to send it this week? I'd like to reach them before [reason]."},
    {"shape":"defer","soundsLike":"Let me check with them first.","pivot":"Of course. Would it help if I sent you a short note about why I want to talk to them?"},
    {"shape":"deflect","soundsLike":"I don't know them, but I know someone who does.","pivot":"That's even better. Who do you know that knows someone there?"},
    {"shape":"counter_ask","soundsLike":"What would you want to talk to them about?","pivot":"Not a job. I want to understand how [company] is thinking about [topic] and whether my background fits anywhere they're growing."},
    {"shape":"decline","soundsLike":"I'd rather not make intros right now.","pivot":"I understand. Is there anyone you'd be comfortable with me reaching out to on my own and mentioning your name?"}
  ]$j$::jsonb
$$;

create or replace function pg_temp.four_topics_items()
returns jsonb language sql as $$
  select $j$[
    {"kind":"agenda","headline":"The four topics","detail":null},
    {"kind":"question","headline":"Biggest challenge in your industry right now?","detail":"What's the biggest challenge in your industry right now?"},
    {"kind":"question","headline":"Companies in transition, M&A, or hiring fractional leaders?","detail":"Are you aware of companies in transition, going through M&A, or looking for fractional leadership?"},
    {"kind":"question","headline":"Who in your network is the most connected?","detail":null},
    {"kind":"question","headline":"What tools or recruiters have helped you most?","detail":null}
  ]$j$::jsonb
$$;

-- Net 102 First Call. Description, rubric and points stay as seeded in 0096.
select jasonos.seed_live_strategy(
  'Net 102 First Call', null, null, null, null, null, null,
  'net102_first',
  pg_temp.browning_blocks($j${
    "what_how": [
      {"label":"What I hope to learn","text":""},
      {"label":"How they can help me","text":""},
      {"label":"How I can help them","text":"I have Browning's network and my own. Tell me who you're trying to reach and I'll see who I know."}
    ],
    "expectations": "Here's what I was hoping to cover in the next 20 minutes: how your search is going, where I can help, and a quick snapshot of where I am. Do you still have 30 minutes?",
    "rapport": [
      {"label":"Compliment","text":"I was impressed by [specific accomplishment]. I did something close to it at OUTFRONT / Omnicom and I'd like to hear how you approached it."},
      {"label":"Common ground","text":""},
      {"label":"Attention getter","text":"I got your resume from Browning. Reading it, [one specific thing from their background] stood out, and I thought we could be useful to each other."}
    ],
    "ask": "Soft ask, only if the call is going well. Given your years in [industry], you're probably more plugged in than I am to who's doing what. Who would you at least suggest I put on my radar right now?",
    "close": "I'm glad Browning connected us. I'm going to reach out to a few people where I think you'd be valued and hand them off when I hear back. Can we circle back two weeks from today? I'll send a calendar invite. What day works?"
  }$j$::jsonb),
  pg_temp.browning_budget(),
  pg_temp.objections_circle_back() || pg_temp.objections_radar()
);

-- Net 102 Second Call. Description, rubric and points stay as seeded in 0096.
select jasonos.seed_live_strategy(
  'Net 102 Second Call', null, null, null, null, null, null,
  'net102_second',
  pg_temp.browning_blocks($j${
    "what_how": [
      {"label":"What I hope to learn","text":""},
      {"label":"How they can help me","text":""},
      {"label":"How I can help them","text":"Bring one thing I did for them since the first call."}
    ],
    "expectations": "Three things today: what I did for you since we spoke, our target lists, and one specific name. Is 30 minutes still good?",
    "rapport": [
      {"label":"Compliment","text":""},
      {"label":"Common ground","text":""},
      {"label":"Attention getter","text":"After our last call I reached out to [name] about [their need]. Here's where that stands."}
    ],
    "turn_to_me": [
      {"label":"Profile check","text":"Did you get a chance to look at my profile? Any thoughts on how my background reads to someone in your seat?"},
      {"label":"Snapshot","text":"Here are the companies I'm focused on: {{targets}}. I'll put this in an email too."},
      {"label":"If asked \"are you looking\"","text":"Don't say \"I'm looking for a job.\" Now: [what I'm doing]. Next: [the seat I want]. Why: [why I'm right for it]."}
    ],
    "ask": "I noticed you're connected to [name] at [company]. That's a place I think I could add value. How well do you know them?\n\nIf they offer to pass my resume along: Thank you. Let me give you my executive profile instead. When you talk to them, would it be possible to set up a short conversation first?",
    "close": "Here's what I'll do by [date]. Can we check in again in three weeks? I'll send a calendar invite."
  }$j$::jsonb),
  pg_temp.browning_budget(),
  pg_temp.objections_named_person()
);

select jasonos.seed_live_strategy(
  'Net 101 Own Network',
  $desc$A call with someone in my own network who already knows me (A1, B1, C1).$desc$,
  $sit$Someone who will pick up the phone. They know me, but not what I'm working on now.$sit$,
  $suc$They hear what I'm working on in under 60 seconds, name at least one person or company for me, and we set the next touch with a date.$suc$,
  $rub$["Stated why we are talking in the first minute","Asked for advice, not a job","Asked what they are working on before talking about me","Gave the snapshot in under 60 seconds","Asked about one named person from their network","Set the next touch with a date"]$rub$::jsonb,
  $src$Browning Associates method, phase 1 (personal network). See docs/strategies/browning-playbooks.md.$src$,
  pg_temp.items_unless_present('Net 101 Own Network', pg_temp.four_topics_items()),
  'net101',
  pg_temp.browning_blocks($j${
    "what_how": [
      {"label":"What I hope to learn","text":""},
      {"label":"How they can help me","text":""},
      {"label":"How I can help them","text":"Ask what they're working on and who they're trying to reach before I ask for anything."}
    ],
    "expectations": "I'd love 30 minutes. I want to hear what you're working on, tell you what I'm doing next, and ask your advice on a couple of companies.",
    "rapport": [
      {"label":"Compliment","text":""},
      {"label":"Common ground","text":"[the last thing we worked on together]"},
      {"label":"Attention getter","text":"It's been a while. I'm working on something career-wise and could use your advice."}
    ],
    "ask": "I'm focused on {{targets}}. I saw you're connected to [name]. Tell me about them.",
    "close": "This helped. Can we talk again in three weeks? I'll send a calendar invite."
  }$j$::jsonb),
  pg_temp.browning_budget(),
  pg_temp.objections_named_person()
);

select jasonos.seed_live_strategy(
  'Net 103 Cold',
  $desc$A first call with someone outside my network and outside Browning's referrals.$desc$,
  $sit$They do not know me. Someone they know suggested we talk.$sit$,
  $suc$They give me 20 minutes of advice, I give the snapshot once, and they name one person or company or agree to talk again.$suc$,
  $rub$["Named the referrer and the purpose in the first minute","Said I was asking for advice, not a job","Offered something before asking","Gave the snapshot in under 60 seconds","Made one who ask, not an if ask","Set a date to talk again"]$rub$::jsonb,
  $src$Browning Associates method, phase 3 (unknown network). See docs/strategies/browning-playbooks.md.$src$,
  pg_temp.items_unless_present('Net 103 Cold', pg_temp.four_topics_items()),
  'net103',
  pg_temp.browning_blocks($j${
    "what_how": [
      {"label":"What I hope to learn","text":""},
      {"label":"How they can help me","text":""},
      {"label":"How I can help them","text":"Offer one specific thing before asking: an intro, an article, a name."}
    ],
    "expectations": "I know you don't know me. [Referrer] suggested we talk. I'm asking for 20 minutes of advice, not a job: how you see [industry], and a quick snapshot of what I'm working on.",
    "rapport": [
      {"label":"Compliment","text":""},
      {"label":"Common ground","text":""},
      {"label":"Attention getter","text":"[Referrer] suggested I reach out. I'm making a career move and [referrer] said you'd be the right person to ask."}
    ],
    "ask": "Given your years in [industry], you're probably more plugged in than I am to who's doing what. Who would you at least suggest I put on my radar right now?",
    "close": "Thank you. Can we talk again in a few weeks, after I follow up on what you suggested? I'll send a calendar invite."
  }$j$::jsonb),
  pg_temp.browning_budget(),
  pg_temp.objections_radar()
);

select jasonos.seed_live_strategy(
  'Int 101 Interview',
  $desc$A job interview with a hiring manager, recruiter, or panel.$desc$,
  $sit$They have my resume and are deciding whether I move forward.$sit$,
  $suc$I answer why this role and why this company, give the snapshot tied to the role, and leave knowing the next step and timeline.$suc$,
  $rub$["Answered why this role and why this company","Gave the snapshot in under 60 seconds, tied to the role","Asked my prepared questions","Asked about next steps and timeline","Sent thank-you notes within 24 hours"]$rub$::jsonb,
  $src$JasonOS playbook. See docs/strategies/browning-playbooks.md.$src$,
  pg_temp.items_unless_present('Int 101 Interview', '[]'::jsonb),
  'int101',
  $j$[
    {"key":"who","title":"Who","kind":"text","required":false,"default":null,"rule":"Read the job description and their LinkedIn. Know their part in the decision."},
    {"key":"why","title":"Why","kind":"lines","required":true,"default":[{"label":"Why this role","text":""},{"label":"Why this company","text":""}],"rule":"Answer the whys before you walk in."},
    {"key":"turn_to_me","title":"Turn to me","kind":"lines","required":false,"default":[{"label":"Snapshot","text":"{{snapshot}}"},{"label":"If asked why I'm looking","text":"Now: [what I'm doing]. Next: this role. Why: [why I'm right for it]."}],"rule":"Snapshot under 60 seconds, tied to this role."},
    {"key":"conversation","title":"The conversation","kind":"points","required":false,"default":null,"rule":"Bring your questions. Ask what the first 90 days look like."},
    {"key":"ask","title":"The ask","kind":"ask","required":false,"default":"What are the next steps, and when should I expect to hear from you?","rule":"Ask about next steps and timeline."},
    {"key":"close","title":"Close","kind":"text","required":false,"default":"Thank you. I want this role. I'll look for [next step] by [date].","rule":"Confirm the next step and who owns it."},
    {"key":"after","title":"After","kind":"after","required":false,"default":null,"rule":"Thank-you within 24 hours to each person you met."}
  ]$j$::jsonb,
  null,
  '[]'::jsonb
);

select jasonos.seed_live_strategy(
  'Advisors Intro',
  $desc$First conversation with a business contact who may become a client, partner or collaborator for Kuperman Advisors or AgencyToolBox.ai.$desc$,
  $sit$A first call with someone I have not worked with, where I need to explain who I am and what I do, learn what they are building, and find out whether there is a reason to talk again.$sit$,
  $suc$I learn what {{name}} is building and what they need, I explain Kuperman Advisors and AgencyToolBox.ai in under three minutes combined, and we agree on a specific next step.$suc$,
  $rub$["Asked what they are building before explaining what I do","Gave the background in under 60 seconds","Explained Kuperman Advisors in one minute with one client example","Explained AgencyToolBox.ai in one minute with how it came to be","Asked what they need right now","Named one way I could help them","Agreed on a next step with a date"]$rub$::jsonb,
  $src$Jason's narratives (Settings) and the Browning "ask first" rule.$src$,
  pg_temp.items_unless_present('Advisors Intro', $j$[
    {"kind":"question","headline":"What is {{company}} building right now?","detail":"Before I go through my background, tell me what you are working on and what prompted this call."},
    {"kind":"question","headline":"What do you need right now?","detail":"What is the thing you are trying to solve this quarter that you do not have the right person for?"},
    {"kind":"point","headline":"One way I could help","detail":"Name the one thing from the conversation where my work fits. One sentence. Do not pitch a second thing."}
  ]$j$::jsonb),
  'advisors',
  $j$[
    {"key":"who","title":"Who","kind":"text","required":false,"default":null,"rule":"Read their site and LinkedIn. Know what they are building."},
    {"key":"what_how","title":"What and how","kind":"lines","required":false,"default":[{"label":"What I hope to learn","text":"What {{company}} is building and what they need this quarter."},{"label":"How they can help me","text":""},{"label":"How I can help them","text":"Name the one thing from the conversation where my work fits. One sentence. Do not pitch a second thing."}],"rule":"Ask what they are building before you explain what you do."},
    {"key":"turn_to_me","title":"Turn to me","kind":"lines","required":false,"default":[{"label":"60-second background","text":"{{snapshot}}"},{"label":"Kuperman Advisors","text":"{{narrative:kuperman_advisors}}"},{"label":"AgencyToolBox.ai and how it came to be","text":"{{narrative:agencytoolbox}}"}],"rule":"Background in under 60 seconds. Each business in one minute with one example."},
    {"key":"points","title":"Points","kind":"points","required":false,"default":null,"rule":"What they need right now. One way you could help."},
    {"key":"ask","title":"The ask","kind":"ask","required":false,"default":"Is there a reason for a second conversation, and what should it be: a working session, an intro to someone on your team, or a proposal?","rule":"One next step with a date."},
    {"key":"close","title":"Close","kind":"text","required":false,"default":"Put the next step on the calendar before we hang up. I'll send a note today with what we agreed.","rule":"A date before you hang up."},
    {"key":"after","title":"After","kind":"after","required":false,"default":null,"rule":"Send the note today with what you agreed."}
  ]$j$::jsonb,
  null,
  $j$[
    {"shape":"agree","soundsLike":"Yes. Let's book a working session.","pivot":"I'll send two times today. What should we walk through?"},
    {"shape":"soft_agree","soundsLike":"That could be useful. Let me think on it.","pivot":"I'll send a note today with the one thing we named, and a time next week."},
    {"shape":"defer","soundsLike":"I'm buried this month.","pivot":"Understood. I'll send the note today and a time for later."},
    {"shape":"deflect","soundsLike":"You should talk to my head of growth.","pivot":"Will you introduce us? I'll send a short note they can read first."},
    {"shape":"counter_ask","soundsLike":"What does working together look like?","pivot":"A working session first. If that is useful, we talk about a scope."},
    {"shape":"decline","soundsLike":"I don't think we need this.","pivot":"Fair. If that problem comes back, the note I send today is enough to restart."}
  ]$j$::jsonb
);

select jasonos.seed_live_strategy(
  'AgencyToolBox Pitch',
  $desc$Showing AgencyToolBox.ai to a firm or collective that runs client engagements.$desc$,
  $sit$A first call where I want them to see the tools on a real example and connect me to whoever owns tooling.$sit$,
  $suc$They see the tools on a real example, name the person who owns tooling, and pick a client for a free diagnostic.$suc$,
  $rub$["Asked how their work flows before showing anything","Asked what the first 30 days of an engagement look like","Showed the tool on a real example","Made one ask: the tooling owner or a group slot","Left with the offer and a date"]$rub$::jsonb,
  $src$Generalized from The Connective Intro - AgencyToolbox.ai. See docs/strategies/browning-playbooks.md.$src$,
  pg_temp.items_unless_present('AgencyToolBox Pitch', $j$[
    {"kind":"agenda","headline":"Them first","detail":null},
    {"kind":"question","headline":"What do the first 30 days of a new engagement look like?","detail":"Listen for repeated manual work: stack audits, ICP, messaging, board decks. Each one is a module already built."},
    {"kind":"agenda","headline":"Show, don't describe","detail":null},
    {"kind":"question","headline":"How is your team handling AI?","detail":"Is everyone improvising, or is there a house approach?"},
    {"kind":"point","headline":"AI Leverage Sprint, aimed at the firm","detail":"Only if the answer is \"everyone improvises.\" Frame it for the firm, not the person."},
    {"kind":"point","headline":"The offer","detail":"A free Sprint-style diagnostic on one of your clients, so you walk away with something to show."}
  ]$j$::jsonb),
  'pitch',
  $j$[
    {"key":"who","title":"Who","kind":"text","required":false,"default":null,"rule":"Know how work flows to them and who owns tooling."},
    {"key":"what_how","title":"What and how","kind":"lines","required":false,"default":[{"label":"What I hope to learn","text":"Where their team repeats manual work in the first 30 days of an engagement."},{"label":"How they can help me","text":""},{"label":"How I can help them","text":"{{narrative:agencytoolbox}}"}],"rule":"Them first. Show, don't describe."},
    {"key":"points","title":"Points","kind":"points","required":false,"default":null,"rule":"Listen for repeated manual work. Each one is a module already built."},
    {"key":"ask","title":"The ask","kind":"ask","required":false,"default":"Who owns tooling or operations at {{company}}? I'd like 20 minutes with them, or a slot to show this to the broader group.","rule":"One ask: the tooling owner or a slot with the group."},
    {"key":"close","title":"Close","kind":"text","required":false,"default":"Here's the offer: a free Sprint-style diagnostic on one of your clients, so you walk away with something to show. Which client, and when?","rule":"Leave with the offer and a date."},
    {"key":"after","title":"After","kind":"after","required":false,"default":null,"rule":"Send two forwardable sentences the same day."}
  ]$j$::jsonb,
  null,
  $j$[
    {"shape":"agree","soundsLike":"Sure, I'll connect you.","pivot":"Thank you. I'll send you two sentences you can forward today."},
    {"shape":"soft_agree","soundsLike":"Let me think about who that is.","pivot":"Who sets the shared tools now, even informally? That's the person."},
    {"shape":"defer","soundsLike":"Let's see how the diagnostic goes first.","pivot":"Fair. Pick the client and I'll have it back to you within 72 hours. Can we put the intro on the calendar for after that?"},
    {"shape":"deflect","soundsLike":"That's really the founder's call.","pivot":"Would you be comfortable mentioning it to them? I'll follow up directly if that's easier."},
    {"shape":"counter_ask","soundsLike":"What would you want from the team?","pivot":"Twenty minutes to show the tools and hear how you handle the first 30 days. No pitch."},
    {"shape":"decline","soundsLike":"We don't really do vendor intros.","pivot":"Understood. Then let's do the diagnostic on one of your clients, and you decide afterward whether it's worth sharing."}
  ]$j$::jsonb
);

select jasonos.seed_live_strategy(
  'Blank',
  $desc$Start here for a call that fits no other playbook.$desc$,
  null,
  null,
  '[]'::jsonb,
  null,
  pg_temp.items_unless_present('Blank', '[]'::jsonb),
  'blank',
  $j$[
    {"key":"who","title":"Who","kind":"text","required":false,"default":null,"rule":"Who this is and why now."},
    {"key":"custom:what_i_want","title":"What I want from this call","kind":"text","required":true,"default":null,"rule":"One sentence. You score the call against it."},
    {"key":"points","title":"Points","kind":"points","required":false,"default":null,"rule":null},
    {"key":"close","title":"Close","kind":"text","required":false,"default":null,"rule":"A next step with a date."},
    {"key":"after","title":"After","kind":"after","required":false,"default":null,"rule":"Thank-you within 24 hours."}
  ]$j$::jsonb,
  null,
  '[]'::jsonb
);

-- Question bank: shared questions, replaced by source on every run.
delete from jasonos.playbook_questions
where playbook_id is null
  and source in (
    'The 4 Topics',
    'Networking 102',
    'Networking 102 (2nd Call)',
    'The Ask and Why',
    'Browning coaching call, Jul 15 2026',
    'Jason''s original Browning points'
  );

insert into jasonos.playbook_questions (topic, text, spoken, source, position)
values
  ('industry', 'Biggest challenge in their industry right now',
    $q$What's the biggest challenge in your industry right now?$q$, 'The 4 Topics', 1),
  ('industry', 'What the job market looks like from their seat',
    $q$What are you seeing in hiring, org changes, or budget at {{company}} or in your sector?$q$, 'Jason''s original Browning points', 2),

  ('company', 'Companies in transition, M&A, or looking for fractional leadership',
    $q$Are you aware of companies in transition, going through M&A, or looking for fractional leadership?$q$, 'The 4 Topics', 1),
  ('company', 'Companies they are trying to get into',
    $q$What companies are you trying to get into?$q$, 'Networking 102 (2nd Call)', 2),
  ('company', 'Where they see the most traction',
    $q$Where are you seeing the most traction?$q$, 'Networking 102 (2nd Call)', 3),

  ('contacts', 'Most connected person in their network',
    $q$Who in your network is the most connected?$q$, 'The 4 Topics', 1),
  ('contacts', 'Who to put on my radar',
    $q$Given your years in [industry], you're probably more plugged in than I am to who's doing what. Who would you at least suggest I put on my radar right now?$q$, 'The Ask and Why', 2),
  ('contacts', 'How well they know a named connection',
    $q$I noticed you're connected to [name] at [company]. That's a place I think I could add value. How well do you know them?$q$, 'The Ask and Why', 3),
  ('contacts', 'Who knows someone at a target company',
    $q$Who do you know that knows someone at [target company]?$q$, 'The Ask and Why', 4),
  ('contacts', 'Tell me about a shared connection',
    $q$I saw we have a shared connection, [name]. Tell me about them.$q$, 'Browning coaching call, Jul 15 2026', 5),
  ('contacts', 'Anyone else at their company to talk to',
    $q$Is there a hiring manager, team lead, or peer at {{company}} you'd suggest I talk to?$q$, 'Jason''s original Browning points', 6),
  ('contacts', 'A conversation before passing a resume',
    $q$Thank you for offering. Let me give you my executive profile instead. When you talk to them, would it be possible to set up a short conversation first?$q$, 'Networking 102 (2nd Call)', 7),

  ('resources', 'Tools or recruiters that helped most',
    $q$What tools or recruiters have helped you most?$q$, 'The 4 Topics', 1),
  ('resources', 'Ideas to increase visibility',
    $q$What have you seen work to increase your visibility?$q$, 'Browning coaching call, Jul 15 2026', 2),

  ('rapport', 'Still at their company? Still looking?',
    $q$I'm not sure I have the latest version. Are you still at {{company}}? Browning mentioned you were looking at one point. Is that still the case?$q$, 'Networking 102', 1),
  ('rapport', 'How the search is going',
    $q$How long have you been looking? What are you seeing? Is it picking up? Are you networking weekly?$q$, 'Networking 102', 2),
  ('rapport', 'If they landed: how they found it',
    $q$How did you find it? Was it through networking? What are the challenges in the new role?$q$, 'Networking 102', 3),
  ('rapport', 'How they got to where they are',
    $q$How did you get from your early career to {{title}} at {{company}}? What moves mattered?$q$, 'Jason''s original Browning points', 4),

  ('turn_to_me', 'Have they looked at my profile',
    $q$Have you had a chance to look at my executive profile?$q$, 'Networking 102', 1),
  ('turn_to_me', 'Permission for the snapshot',
    $q$While I have you, may I give you a quick snapshot of where I am?$q$, 'Networking 102', 2),
  ('turn_to_me', 'How my background reads',
    $q$Any thoughts on how my background reads to someone in your seat?$q$, 'Networking 102 (2nd Call)', 3);

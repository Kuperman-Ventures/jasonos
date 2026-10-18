-- Browning baseline strategies and the shared snapshot used by {{snapshot}} and {{targets}}.
-- Re-running replaces the seeded strategies and leaves every other strategy alone.
-- Service-role only, same arrangement as 0095_live_strategy_and_score.sql.
-- Safe to re-run.

set search_path = jasonos, public;

create table if not exists jasonos.live_settings (
  id boolean primary key default true check (id),
  target_companies text[] not null default '{}',
  snapshot text,
  updated_at timestamptz not null default now()
);

comment on table jasonos.live_settings is
  'One row. The 60-second snapshot and target companies filled into {{snapshot}} and {{targets}} when a strategy is applied.';

insert into jasonos.live_settings (id) values (true) on conflict do nothing;

alter table jasonos.live_settings enable row level security;
revoke all on table jasonos.live_settings from anon, authenticated;

drop trigger if exists live_settings_set_updated_at on jasonos.live_settings;
create trigger live_settings_set_updated_at
  before update on jasonos.live_settings
  for each row execute function jasonos.set_updated_at();

-- Rename the hand-made strategy so the seed below updates it in place.
update jasonos.live_scripts
  set name = 'Browning Networking - First Call'
  where name = 'Browning Networking Meeting';

create or replace function jasonos.seed_live_strategy(
  p_name text, p_description text, p_situation text, p_success text,
  p_rubric jsonb, p_source text, p_items jsonb
) returns uuid language plpgsql set search_path = jasonos, public as $$
declare v_id uuid;
begin
  insert into jasonos.live_scripts (name, description, situation, success_sentence, rubric, methodology_source)
  values (p_name, p_description, p_situation, p_success, p_rubric, p_source)
  on conflict (name) do update set
    description = excluded.description, situation = excluded.situation,
    success_sentence = excluded.success_sentence, rubric = excluded.rubric,
    methodology_source = excluded.methodology_source, updated_at = now()
  returning id into v_id;
  delete from jasonos.live_script_items where script_id = v_id;
  insert into jasonos.live_script_items (script_id, position, kind, headline, detail, prepare_reactions, reactions)
  select v_id, (ordinality)::int, item->>'kind', item->>'headline', item->>'detail',
         coalesce((item->>'prepare_reactions')::boolean, false), coalesce(item->'reactions', '[]'::jsonb)
  from jsonb_array_elements(p_items) with ordinality as t(item, ordinality);
  return v_id;
end $$;

revoke all on function jasonos.seed_live_strategy(text, text, text, text, jsonb, text, jsonb) from public, anon, authenticated;

select jasonos.seed_live_strategy(
  'Browning Networking - First Call',
  $desc$Frequent Browning-introduced networking meetings with people of various backgrounds and relevance to my job search.$desc$,
  $sit$A first conversation with a Browning referral: a peer executive who spoke to Browning, agreed to connect, and has my resume, but does not know me and may not remember Browning.$sit$,
  $suc$They talk about themselves for most of the call, I give the 60-second snapshot once, and we leave with a dated second call on both calendars.$suc$,
  $rub$["Opened with the attention getter: Browning, why them, purpose of the call","Paid one specific, genuine compliment from their resume","Asked whether they are still at their company and still looking before anything else","Asked how their search is going and what they are seeing","Offered to help them before asking for anything","Asked whether they have looked at my executive profile","Gave the snapshot in under 60 seconds","Did not ask directly for a job or whether their company is hiring","Made no more than one soft ask for contacts, or deferred the ask to call two","Set a date and time for the second call before hanging up","Said I would send a calendar invite and a thank-you note"]$rub$::jsonb,
  $src$Browning Associates method: Networking 102, Working Your Referrals, The 4 Topics, The Ask and Why. See docs/strategies/browning-networking.md.$src$,
  $items$[{"kind":"agenda","headline":"Attention getter","detail":null,"prepare_reactions":false,"reactions":[]},{"kind":"point","headline":"Why them, why now","detail":"I got your resume from Browning. Reading it, [one specific thing from their background] stood out, and I thought we could be useful to each other. Here's what I was hoping to cover in the next 20 minutes.","prepare_reactions":false,"reactions":[]},{"kind":"point","headline":"One genuine compliment","detail":"I was impressed by [specific accomplishment]. I did something close to it at OUTFRONT / Omnicom and I'd like to hear how you approached it.","prepare_reactions":false,"reactions":[]},{"kind":"agenda","headline":"Assess and relate","detail":null,"prepare_reactions":false,"reactions":[]},{"kind":"question","headline":"Still at {{company}}? Still looking?","detail":"I'm not sure I have the latest version. Are you still at {{company}}? Browning mentioned you were looking at one point. Is that still the case?","prepare_reactions":false,"reactions":[]},{"kind":"question","headline":"How is the search going?","detail":"If looking: how long, what are you seeing, is it picking up, are you networking weekly. If landed: how did you find it, was it through networking, what are the challenges in the new role.","prepare_reactions":false,"reactions":[]},{"kind":"point","headline":"Offer help first","detail":"I have Browning's network and my own. Tell me who you're trying to reach and I'll see who I know.","prepare_reactions":false,"reactions":[]},{"kind":"question","headline":"Pick one of the 4 Topics","detail":"Industry: what's the biggest challenge in your industry right now. Company: are you aware of companies in transition, M&A, or looking for fractional leadership. Network: who in your network is the most connected. Resources: what tools or recruiters have helped you most.","prepare_reactions":false,"reactions":[]},{"kind":"agenda","headline":"Turn to me","detail":null,"prepare_reactions":false,"reactions":[]},{"kind":"question","headline":"Have you looked at my executive profile?","detail":"If no: I'd appreciate it when you get a chance. While I have you, may I give you a quick snapshot of where I am?","prepare_reactions":false,"reactions":[]},{"kind":"point","headline":"The 60-second snapshot","detail":"{{snapshot}} Target companies: {{targets}}.","prepare_reactions":false,"reactions":[]},{"kind":"agenda","headline":"Call to action","detail":null,"prepare_reactions":false,"reactions":[]},{"kind":"ask","headline":"Can we circle back in two weeks?","detail":"I might have some good people for you, and your network may be able to help me. Can we circle back two weeks from today? I'll send a calendar invite. What day works?","prepare_reactions":true,"reactions":[{"shape":"agree","soundsLike":"Sure, send me an invite.","pivot":"Great. I'll send it for [day] at [time]. I'll have a couple of names for you by then."},{"shape":"soft_agree","soundsLike":"Yeah, let's stay in touch.","pivot":"Let's put something on the calendar so it actually happens. Does the week of the [date] work?"},{"shape":"defer","soundsLike":"I'm swamped the next few weeks.","pivot":"Understood. I'll send a note in three weeks with a couple of times. Is email the best way to reach you?"},{"shape":"deflect","soundsLike":"You should really talk to my colleague about this.","pivot":"I'd like that. Would you be willing to introduce us? And I'd still like to keep our line open."},{"shape":"counter_ask","soundsLike":"What exactly are you hoping I can do?","pivot":"Two things. Help me understand what's going on at {{targets}}, and let me help you with anyone you're trying to reach."},{"shape":"decline","soundsLike":"I don't think I'm the right person to help.","pivot":"That's fair. Can I at least stay connected on LinkedIn and send you anything useful I come across?"}]},{"kind":"ask","headline":"Who would you suggest I put on my radar?","detail":"Soft ask, only if the call is going well. Given your years in [industry], you're probably more plugged in than I am to who's doing what. Who would you at least suggest I put on my radar right now?","prepare_reactions":true,"reactions":[{"shape":"agree","soundsLike":"A couple of people come to mind.","pivot":"Who are they, and would you be comfortable with me mentioning your name?"},{"shape":"soft_agree","soundsLike":"Let me think about it and get back to you.","pivot":"Thank you. I'll follow up in my thank-you note so it's easy to reply to."},{"shape":"defer","soundsLike":"Let's talk again once I know you better.","pivot":"That makes sense. That's exactly why I want the second call."},{"shape":"deflect","soundsLike":"My network is mostly in [other industry].","pivot":"That's fine. We're not competing. Who in that industry knows people in mine?"},{"shape":"counter_ask","soundsLike":"What companies are you targeting?","pivot":"{{targets}}. Who do you know that knows someone at any of those?"},{"shape":"decline","soundsLike":"I don't really know anyone who's hiring.","pivot":"I'm not looking for people who are hiring. I'm looking for people worth knowing. Who's the most connected person in your network?"}]},{"kind":"point","headline":"Close","detail":"I'm glad Browning connected us. I'm going to reach out to a few people where I think you'd be valued and hand them off when I hear back. Let's partner on this.","prepare_reactions":false,"reactions":[]}]$items$::jsonb
);

select jasonos.seed_live_strategy(
  'Browning Networking - Second Call',
  $desc$Follow-up call with a Browning referral after the first conversation and thank-you note.$desc$,
  $sit$A follow-up with a Browning referral after a first call and a thank-you note. They have my profile and we have a reason to talk again.$sit$,
  $suc$I deliver something useful to them, they name at least one specific person or company for me, and we agree on what happens next and when.$suc$,
  $rub$["Opened with what I did for them since the first call","Confirmed they connected on LinkedIn and looked at my profile","Shared my target company list with geography","Asked for a specific list of companies they are targeting","Asked where they are seeing the most traction","Made one specific ask using a who question, not an if question","Did not accept \"send me your resume\" without asking for a conversation first","Agreed on the next step and date"]$rub$::jsonb,
  $src$Browning Associates method: Networking 102 (2nd Call section), The Ask and Why. See docs/strategies/browning-networking.md.$src$,
  $items$[{"kind":"agenda","headline":"Open","detail":null,"prepare_reactions":false,"reactions":[]},{"kind":"point","headline":"What I did since we spoke","detail":"After our last call I reached out to [name] about [their need]. Here's where that stands.","prepare_reactions":false,"reactions":[]},{"kind":"question","headline":"Did you get a chance to look at my profile?","detail":"Any thoughts on how my background reads to someone in your seat?","prepare_reactions":false,"reactions":[]},{"kind":"agenda","headline":"Exchange","detail":null,"prepare_reactions":false,"reactions":[]},{"kind":"point","headline":"My target list","detail":"Here are the companies I'm focused on: {{targets}}. I'll put this in an email too.","prepare_reactions":false,"reactions":[]},{"kind":"question","headline":"Your target list","detail":"What companies are you trying to get into? Where are you seeing the most traction?","prepare_reactions":false,"reactions":[]},{"kind":"agenda","headline":"The ask","detail":null,"prepare_reactions":false,"reactions":[]},{"kind":"ask","headline":"Who do you know at [target company]?","detail":"I noticed you're connected to [name] at [company]. That's a place I think I could add value. How well do you know them?","prepare_reactions":true,"reactions":[{"shape":"agree","soundsLike":"I know them well. I'll make an intro.","pivot":"Thank you. I'll send you two sentences you can forward so it's easy."},{"shape":"soft_agree","soundsLike":"I can probably do that at some point.","pivot":"Would it be too much to ask to send it this week? I'd like to reach them before [reason]."},{"shape":"defer","soundsLike":"Let me check with them first.","pivot":"Of course. Would it help if I sent you a short note about why I want to talk to them?"},{"shape":"deflect","soundsLike":"I don't know them, but I know someone who does.","pivot":"That's even better. Who do you know that knows someone there?"},{"shape":"counter_ask","soundsLike":"What would you want to talk to them about?","pivot":"Not a job. I want to understand how [company] is thinking about [topic] and whether my background fits anywhere they're growing."},{"shape":"decline","soundsLike":"I'd rather not make intros right now.","pivot":"I understand. Is there anyone you'd be comfortable with me reaching out to on my own and mentioning your name?"}]},{"kind":"ask","headline":"If they offer to pass my resume along","detail":"Thank you for offering. I have so many versions, let me give you my executive profile instead. When you talk to them, would it be possible to set up a short conversation first?","prepare_reactions":false,"reactions":[]},{"kind":"agenda","headline":"Close","detail":null,"prepare_reactions":false,"reactions":[]},{"kind":"point","headline":"Next step and date","detail":"Here's what I'll do by [date]. Can we check in again in three weeks?","prepare_reactions":false,"reactions":[]}]$items$::jsonb
);

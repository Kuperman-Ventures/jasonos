-- Live restart: decks + slides. Convert playbooks/plans/meeting sheets, then drop the old Live model.
-- Kept: meeting_preps.company_id (0104) — calendar sync / meeting-prep still use it.
-- Kept: meeting_preps.plan_source, handoff_id, packet_highlights (0101 Browning).
-- Kept: library_kinds / library_items (0091, not Live).
-- Kept: purpose* on meeting_preps (0082).
-- Safe to re-run only if decks does not already exist.

set search_path = jasonos, public;

create table if not exists jasonos.decks (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('playbook', 'slides')),
  name text not null,
  description text,
  source_playbook_id uuid references jasonos.decks(id) on delete set null,
  meeting_prep_id uuid references jasonos.meeting_preps(id) on delete set null,
  ai_notes text,
  ai_undo jsonb,
  run_started_at timestamptz,
  run_ended_at timestamptz,
  transcript text,
  transcript_source text check (transcript_source in ('granola', 'wispr')),
  transcript_note_id text,
  transcript_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists decks_meeting_prep_idx
  on jasonos.decks (meeting_prep_id)
  where meeting_prep_id is not null;

create index if not exists decks_kind_name_idx on jasonos.decks (kind, name);

create table if not exists jasonos.slides (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references jasonos.decks(id) on delete cascade,
  position integer not null,
  headline text not null default '',
  bullets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deck_id, position) deferrable initially deferred
);

create index if not exists slides_deck_position_idx on jasonos.slides (deck_id, position);

drop trigger if exists decks_set_updated_at on jasonos.decks;
create trigger decks_set_updated_at
  before update on jasonos.decks
  for each row execute function public.set_updated_at();

drop trigger if exists slides_set_updated_at on jasonos.slides;
create trigger slides_set_updated_at
  before update on jasonos.slides
  for each row execute function public.set_updated_at();

alter table jasonos.decks enable row level security;
alter table jasonos.slides enable row level security;
revoke all on table jasonos.decks from anon, authenticated;
revoke all on table jasonos.slides from anon, authenticated;

comment on table jasonos.decks is
  'Playbooks (templates) and Slides (one meeting). kind decides which.';
comment on table jasonos.slides is
  'One headline and a short list of bullets. Order is position.';

-- ---------- conversion helpers ----------

create or replace function pg_temp.split_paragraphs(body text)
returns text[] language plpgsql as $$
declare
  parts text[];
  cleaned text;
begin
  cleaned := regexp_replace(coalesce(body, ''), E'\r\n', E'\n', 'g');
  cleaned := btrim(cleaned);
  if cleaned = '' then return array[]::text[]; end if;
  select coalesce(array_agg(btrim(p) order by ordinality), array[]::text[])
  into parts
  from regexp_split_to_table(cleaned, E'\n\s*\n') with ordinality as t(p, ordinality)
  where btrim(p) <> '';
  return parts;
end;
$$;

create or replace function pg_temp.block_has_default(block jsonb)
returns boolean language sql as $$
  select case
    when block->>'kind' = 'text' then nullif(btrim(coalesce(block->>'default', '')), '') is not null
    when block->>'kind' = 'ask' then nullif(btrim(coalesce(block->>'default', '')), '') is not null
      or (
        jsonb_typeof(block->'default') = 'array'
        and exists (
          select 1 from jsonb_array_elements(block->'default') line
          where nullif(btrim(coalesce(line->>'text', '')), '') is not null
             or nullif(btrim(coalesce(line->>'label', '')), '') is not null
        )
      )
    when block->>'kind' = 'lines' then
      jsonb_typeof(block->'default') = 'array'
      and jsonb_array_length(block->'default') > 0
    else false
  end;
$$;

create or replace function pg_temp.bullets_from_block_default(block jsonb)
returns jsonb language plpgsql as $$
declare
  bullets text[] := array[]::text[];
  line jsonb;
  label text;
  text_value text;
  para text;
begin
  if block->>'kind' = 'text' then
    foreach para in array pg_temp.split_paragraphs(block->>'default') loop
      bullets := bullets || para;
    end loop;
  elsif block->>'kind' = 'ask' then
    if jsonb_typeof(block->'default') = 'array' then
      for line in select value from jsonb_array_elements(block->'default')
      loop
        label := btrim(coalesce(line->>'label', ''));
        text_value := btrim(coalesce(line->>'text', ''));
        if text_value <> '' then
          bullets := bullets || (case when label <> '' then label || ': ' || text_value else text_value end);
        elsif label <> '' then
          bullets := bullets || (label || ':');
        end if;
      end loop;
    else
      foreach para in array pg_temp.split_paragraphs(block->>'default') loop
        bullets := bullets || para;
      end loop;
    end if;
  elsif block->>'kind' = 'lines' and jsonb_typeof(block->'default') = 'array' then
    for line in select value from jsonb_array_elements(block->'default')
    loop
      label := btrim(coalesce(line->>'label', ''));
      text_value := btrim(coalesce(line->>'text', ''));
      if text_value <> '' then
        bullets := bullets || (case when label <> '' then label || ': ' || text_value else text_value end);
      elsif label <> '' then
        bullets := bullets || (label || ':');
      end if;
    end loop;
  end if;
  return to_jsonb(bullets);
end;
$$;

create or replace function pg_temp.bullets_from_sheet_block(kind text, body text, lines jsonb)
returns jsonb language plpgsql as $$
declare
  bullets text[] := array[]::text[];
  line jsonb;
  label text;
  text_value text;
  para text;
begin
  if kind in ('text', 'ask', 'after') then
    foreach para in array pg_temp.split_paragraphs(body) loop
      bullets := bullets || para;
    end loop;
    if kind = 'ask' and jsonb_typeof(lines) = 'array' then
      for line in select value from jsonb_array_elements(lines)
      loop
        label := btrim(coalesce(line->>'label', ''));
        text_value := btrim(coalesce(line->>'text', ''));
        if text_value <> '' then
          bullets := bullets || (case when label <> '' then label || ': ' || text_value else text_value end);
        elsif label <> '' then
          bullets := bullets || (label || ':');
        end if;
      end loop;
    end if;
  elsif kind = 'lines' and jsonb_typeof(lines) = 'array' then
    for line in select value from jsonb_array_elements(lines)
    loop
      label := btrim(coalesce(line->>'label', ''));
      text_value := btrim(coalesce(line->>'text', ''));
      if text_value <> '' then
        bullets := bullets || (case when label <> '' then label || ': ' || text_value else text_value end);
      elsif label <> '' then
        bullets := bullets || (label || ':');
      end if;
    end loop;
  end if;
  return to_jsonb(bullets);
end;
$$;

create or replace function pg_temp.apply_snapshot(bullets jsonb, snapshot text)
returns jsonb language plpgsql as $$
declare
  out_bullets text[] := array[]::text[];
  bullet text;
  next_text text;
begin
  for bullet in select jsonb_array_elements_text(bullets)
  loop
    next_text := replace(bullet, '{{snapshot}}', coalesce(snapshot, ''));
    if position('{{' in next_text) = 0 and btrim(next_text) <> '' then
      out_bullets := out_bullets || btrim(next_text);
    end if;
  end loop;
  return to_jsonb(out_bullets);
end;
$$;

-- ---------- convert live_scripts (strategy → playbook, plan → slides) ----------

do $$
declare
  snapshot text;
  script record;
  block jsonb;
  block_ord int;
  slide_pos int;
  new_deck_id uuid;
  item record;
  bullets jsonb;
  objection jsonb;
  objection_bullets text[];
  deck_kind text;
  slide_count int;
begin
  select s.snapshot into snapshot from jasonos.live_settings s limit 1;

  for script in
    select * from jasonos.live_scripts
    where kind in ('strategy', 'plan')
    order by kind, name
  loop
    deck_kind := case when script.kind = 'strategy' then 'playbook' else 'slides' end;
    insert into jasonos.decks (kind, name, description, meeting_prep_id, created_at, updated_at)
    values (
      deck_kind,
      script.name,
      nullif(btrim(coalesce(script.description, '')), ''),
      case when script.kind = 'plan' then script.attached_prep_id else null end,
      script.created_at,
      script.updated_at
    )
    returning id into new_deck_id;

    slide_pos := 0;

    if script.blocks is not null and jsonb_typeof(script.blocks) = 'array' then
      block_ord := 0;
      for block in select value from jsonb_array_elements(script.blocks)
      loop
        block_ord := block_ord + 1;
        if coalesce(block->>'key', '') in ('conversation', 'points', 'after') then
          continue;
        end if;
        if not pg_temp.block_has_default(block) then
          continue;
        end if;
        bullets := pg_temp.apply_snapshot(pg_temp.bullets_from_block_default(block), snapshot);
        -- Skip empty defaults (title alone is not enough).
        if jsonb_array_length(bullets) = 0 then
          continue;
        end if;
        slide_pos := slide_pos + 1;
        insert into jasonos.slides (deck_id, position, headline, bullets)
        values (
          new_deck_id,
          slide_pos,
          coalesce(nullif(btrim(block->>'title'), ''), 'Untitled'),
          bullets
        );
      end loop;
    end if;

    if exists (
      select 1
      from jsonb_array_elements(coalesce(script.blocks, '[]'::jsonb)) b
      where b.value->>'key' in ('conversation', 'points')
    ) or not exists (
      select 1 from jsonb_array_elements(coalesce(script.blocks, '[]'::jsonb))
    ) then
      for item in
        select *
        from jasonos.live_script_items
        where script_id = script.id
        order by position
      loop
        bullets := '[]'::jsonb;
        if nullif(btrim(coalesce(item.detail, '')), '') is not null then
          bullets := bullets || jsonb_build_array(btrim(item.detail));
        end if;
        if nullif(btrim(coalesce(item.listen_for, '')), '') is not null then
          bullets := bullets || jsonb_build_array('Listen for: ' || btrim(item.listen_for));
        end if;
        bullets := pg_temp.apply_snapshot(bullets, snapshot);
        if nullif(btrim(item.headline), '') is null and jsonb_array_length(bullets) = 0 then
          continue;
        end if;
        slide_pos := slide_pos + 1;
        insert into jasonos.slides (deck_id, position, headline, bullets)
        values (
          new_deck_id,
          slide_pos,
          coalesce(nullif(btrim(item.headline), ''), 'Untitled'),
          bullets
        );
      end loop;
    end if;

    if script.objections is not null
      and jsonb_typeof(script.objections) = 'array'
      and jsonb_array_length(script.objections) > 0
    then
      objection_bullets := array[]::text[];
      for objection in select value from jsonb_array_elements(script.objections)
      loop
        if nullif(btrim(coalesce(objection->>'soundsLike', '')), '') is null
          and nullif(btrim(coalesce(objection->>'pivot', '')), '') is null
        then
          continue;
        end if;
        objection_bullets := objection_bullets || (
          '"' || replace(coalesce(objection->>'soundsLike', ''), '"', '''') || '" → '
          || coalesce(objection->>'pivot', '')
        );
      end loop;
      if array_length(objection_bullets, 1) is not null then
        slide_pos := slide_pos + 1;
        insert into jasonos.slides (deck_id, position, headline, bullets)
        values (new_deck_id, slide_pos, 'If they say', to_jsonb(objection_bullets));
      end if;
    end if;

    select count(*)::int into slide_count from jasonos.slides where deck_id = new_deck_id;
    raise notice 'converted % "%" → % slides', deck_kind, script.name, slide_count;
  end loop;
end;
$$;

-- ---------- convert meeting call sheets / points into linked slides ----------

do $$
declare
  prep record;
  block record;
  point record;
  new_deck_id uuid;
  slide_pos int;
  bullets jsonb;
  slide_count int;
begin
  for prep in
    select p.*
    from jasonos.meeting_preps p
    where exists (select 1 from jasonos.call_sheet_blocks b where b.prep_id = p.id)
       or exists (select 1 from jasonos.meeting_points mp where mp.prep_id = p.id)
    order by p.starts_at
  loop
    if exists (select 1 from jasonos.decks d where d.meeting_prep_id = prep.id) then
      raise notice 'skip meeting "%" — slides already linked', prep.title;
      continue;
    end if;

    insert into jasonos.decks (kind, name, meeting_prep_id, created_at, updated_at)
    values (
      'slides',
      coalesce(nullif(btrim(prep.title), ''), 'Untitled meeting'),
      prep.id,
      coalesce(prep.gathered_at, now()),
      now()
    )
    returning id into new_deck_id;

    slide_pos := 0;

    for block in
      select *
      from jasonos.call_sheet_blocks
      where prep_id = prep.id
        and kind not in ('points', 'after')
      order by position
    loop
      bullets := pg_temp.bullets_from_sheet_block(block.kind, block.body, block.lines);
      if jsonb_array_length(bullets) = 0 and nullif(btrim(coalesce(block.title, '')), '') is null then
        continue;
      end if;
      if jsonb_array_length(bullets) = 0 and block.kind in ('who', 'text', 'lines', 'ask')
        and nullif(btrim(coalesce(block.body, '')), '') is null
        and (block.lines is null or block.lines = '[]'::jsonb)
      then
        continue;
      end if;
      -- Skip empty filled-content blocks (title alone with no body/lines).
      if jsonb_array_length(bullets) = 0 then
        continue;
      end if;
      slide_pos := slide_pos + 1;
      insert into jasonos.slides (deck_id, position, headline, bullets)
      values (
        new_deck_id,
        slide_pos,
        coalesce(nullif(btrim(block.title), ''), 'Untitled'),
        bullets
      );
    end loop;

    for point in
      select *
      from jasonos.meeting_points
      where prep_id = prep.id
      order by position
    loop
      bullets := '[]'::jsonb;
      if nullif(btrim(coalesce(point.detail, '')), '') is not null then
        bullets := bullets || jsonb_build_array(btrim(point.detail));
      end if;
      if nullif(btrim(coalesce(point.listen_for, '')), '') is not null then
        bullets := bullets || jsonb_build_array('Listen for: ' || btrim(point.listen_for));
      end if;
      if nullif(btrim(point.headline), '') is null and jsonb_array_length(bullets) = 0 then
        continue;
      end if;
      slide_pos := slide_pos + 1;
      insert into jasonos.slides (deck_id, position, headline, bullets)
      values (
        new_deck_id,
        slide_pos,
        coalesce(nullif(btrim(point.headline), ''), 'Untitled'),
        bullets
      );
    end loop;

    select count(*)::int into slide_count from jasonos.slides where deck_id = new_deck_id;
    raise notice 'converted meeting "%" → % slides', prep.title, slide_count;
  end loop;
end;
$$;

-- ---------- drop old Live model ----------
-- Columns dropped from meeting_preps (Live 0092–0109; kept company_id from 0104; kept plan_source/handoff_id/packet_highlights from 0101):
--   live_started_at, live_ended_at,
--   script_id,
--   outcome_sentence, outcome_mark, outcome_note, outcome_marked_at,
--   project_id, primary_contact_id, adapted_from_script_id, adapted_at,
--   track, research_ran_at, email_context, email_context_at,
--   plan_built_at,
--   sheet_ready_at, thank_you_draft, thank_you_sent_at
-- Columns dropped from contacts (0106):
--   touch_count, referral_received_at, first_contact_at, to_discuss_next, networking_status

drop function if exists jasonos.reorder_meeting_points(uuid, uuid[]);
drop function if exists jasonos.reorder_live_script_items(uuid, uuid[]);
drop function if exists jasonos.seed_live_strategy(text, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb);

drop table if exists jasonos.meeting_points cascade;
drop table if exists jasonos.call_sheet_blocks cascade;
drop table if exists jasonos.playbook_questions cascade;
drop table if exists jasonos.relationship_log cascade;
drop table if exists jasonos.meeting_reviews cascade;
drop table if exists jasonos.meeting_adaptations cascade;
drop table if exists jasonos.live_script_items cascade;
drop table if exists jasonos.live_scripts cascade;
drop table if exists jasonos.live_settings cascade;
drop table if exists jasonos.narratives cascade;

alter table jasonos.meeting_preps
  drop column if exists live_started_at,
  drop column if exists live_ended_at,
  drop column if exists script_id,
  drop column if exists outcome_sentence,
  drop column if exists outcome_mark,
  drop column if exists outcome_note,
  drop column if exists outcome_marked_at,
  drop column if exists project_id,
  drop column if exists primary_contact_id,
  drop column if exists adapted_from_script_id,
  drop column if exists adapted_at,
  drop column if exists track,
  drop column if exists research_ran_at,
  drop column if exists email_context,
  drop column if exists email_context_at,
  drop column if exists plan_built_at,
  drop column if exists sheet_ready_at,
  drop column if exists thank_you_draft,
  drop column if exists thank_you_sent_at;

alter table jasonos.meeting_preps
  drop constraint if exists meeting_preps_outcome_mark_check;

alter table jasonos.contacts
  drop constraint if exists contacts_networking_status_check;

alter table jasonos.contacts
  drop column if exists touch_count,
  drop column if exists referral_received_at,
  drop column if exists first_contact_at,
  drop column if exists to_discuss_next,
  drop column if exists networking_status;

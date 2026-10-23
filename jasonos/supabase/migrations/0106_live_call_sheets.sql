-- Call sheets, playbook blocks, person tracking, relationship log.
-- Idempotent. Service-role only for new tables, same arrangement as 0095.
set search_path = jasonos, public;

-- Playbook block templates and method data
alter table jasonos.live_scripts
  add column if not exists family text not null default 'custom',
  add column if not exists blocks jsonb not null default '[]'::jsonb,
  add column if not exists time_budget jsonb,
  add column if not exists objections jsonb not null default '[]'::jsonb;

alter table jasonos.live_scripts
  drop constraint if exists live_scripts_family_check;
alter table jasonos.live_scripts
  add constraint live_scripts_family_check
  check (family in (
    'net101', 'net102_first', 'net102_second', 'net103',
    'int101', 'advisors', 'pitch', 'blank', 'custom'
  ));

comment on column jasonos.live_scripts.family is
  'Playbook family: Browning networking, interview, advisors, pitch, blank, or custom.';
comment on column jasonos.live_scripts.blocks is
  'Ordered block templates: [{ key, title, kind, required, default, rule }].';
comment on column jasonos.live_scripts.time_budget is
  'Optional minute budget: { expectations, rapport, main, close }.';
comment on column jasonos.live_scripts.objections is
  'Shared objection pivots for asks: [{ shape, soundsLike, pivot }].';

-- Question bank
create table if not exists jasonos.playbook_questions (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  text text not null,
  spoken text,
  source text,
  playbook_id uuid references jasonos.live_scripts(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table jasonos.playbook_questions
  drop constraint if exists playbook_questions_topic_check;
alter table jasonos.playbook_questions
  add constraint playbook_questions_topic_check
  check (topic in (
    'industry', 'company', 'contacts', 'resources', 'rapport', 'turn_to_me', 'other'
  ));

create index if not exists playbook_questions_topic_idx
  on jasonos.playbook_questions (topic, position);
create index if not exists playbook_questions_playbook_idx
  on jasonos.playbook_questions (playbook_id, position);

alter table jasonos.playbook_questions enable row level security;
revoke all on table jasonos.playbook_questions from anon, authenticated;

comment on table jasonos.playbook_questions is
  'Question bank (4 Topics and handbook getting-connections). playbook_id null = shared.';

-- Call sheet blocks
create table if not exists jasonos.call_sheet_blocks (
  id uuid primary key default gen_random_uuid(),
  prep_id uuid references jasonos.meeting_preps(id) on delete cascade,
  sheet_id uuid references jasonos.live_scripts(id) on delete cascade,
  position integer not null,
  key text not null,
  title text not null,
  kind text not null,
  required boolean not null default false,
  body text,
  lines jsonb not null default '[]'::jsonb,
  rule text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table jasonos.call_sheet_blocks
  drop constraint if exists call_sheet_blocks_kind_check;
alter table jasonos.call_sheet_blocks
  add constraint call_sheet_blocks_kind_check
  check (kind in ('text', 'lines', 'points', 'ask', 'after'));

alter table jasonos.call_sheet_blocks
  drop constraint if exists call_sheet_blocks_owner_xor;
alter table jasonos.call_sheet_blocks
  add constraint call_sheet_blocks_owner_xor
  check ((prep_id is not null) <> (sheet_id is not null));

create index if not exists call_sheet_blocks_prep_idx
  on jasonos.call_sheet_blocks (prep_id, position);
create index if not exists call_sheet_blocks_sheet_idx
  on jasonos.call_sheet_blocks (sheet_id, position);

drop trigger if exists call_sheet_blocks_set_updated_at on jasonos.call_sheet_blocks;
create trigger call_sheet_blocks_set_updated_at
  before update on jasonos.call_sheet_blocks
  for each row execute function jasonos.set_updated_at();

alter table jasonos.call_sheet_blocks enable row level security;
revoke all on table jasonos.call_sheet_blocks from anon, authenticated;

comment on table jasonos.call_sheet_blocks is
  'One row per block on a meeting call sheet (prep_id) or an unattached sheet (sheet_id).';

-- Person: Browning tracking columns
alter table jasonos.contacts
  add column if not exists touch_count integer not null default 0,
  add column if not exists referral_received_at timestamptz,
  add column if not exists first_contact_at timestamptz,
  add column if not exists to_discuss_next text,
  add column if not exists networking_status text;

alter table jasonos.contacts
  drop constraint if exists contacts_networking_status_check;
alter table jasonos.contacts
  add constraint contacts_networking_status_check
  check (
    networking_status is null
    or networking_status in (
      'referral', 'first_contacted', 'call_1', 'call_2', 'call_3', 'ongoing', 'closed'
    )
  );

comment on column jasonos.contacts.touch_count is
  'Held calls with this person (relationship_log rows).';
comment on column jasonos.contacts.networking_status is
  'Browning pipeline status. Null when not in networking motion.';
comment on column jasonos.contacts.to_discuss_next is
  'What to bring up on the next call. Written by Debrief.';

-- Relationship log
create table if not exists jasonos.relationship_log (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references jasonos.contacts(id) on delete cascade,
  prep_id uuid references jasonos.meeting_preps(id) on delete set null,
  occurred_at timestamptz not null,
  touch_number integer not null,
  conversation text,
  contacts_received jsonb not null default '[]'::jsonb,
  follow_up_with jsonb not null default '[]'::jsonb,
  next_contact_at date,
  to_discuss_next text,
  thank_you_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists relationship_log_contact_idx
  on jasonos.relationship_log (contact_id, occurred_at);
create unique index if not exists relationship_log_prep_uidx
  on jasonos.relationship_log (prep_id)
  where prep_id is not null;

alter table jasonos.relationship_log enable row level security;
revoke all on table jasonos.relationship_log from anon, authenticated;

comment on table jasonos.relationship_log is
  'One row per held call. Browning tracking-sheet columns.';

-- Thank-you draft and sheet readiness
alter table jasonos.meeting_preps
  add column if not exists sheet_ready_at timestamptz,
  add column if not exists thank_you_draft text,
  add column if not exists thank_you_sent_at timestamptz;

comment on column jasonos.meeting_preps.sheet_ready_at is
  'When Jason marked the call sheet ready (Why gate passed when required).';
comment on column jasonos.meeting_preps.thank_you_draft is
  'Draft thank-you note body. Nothing is sent from JasonOS.';

-- Prefer primary_contact_id; else first attendee with a contact_id (e.g. Molly Millar).
with finished as (
  select
    mp.id as prep_id,
    coalesce(
      mp.primary_contact_id,
      (
        select (att->>'contact_id')::uuid
        from jsonb_array_elements(coalesce(mp.attendees, '[]'::jsonb)) att
        where att ? 'contact_id'
          and nullif(att->>'contact_id', '') is not null
        limit 1
      )
    ) as contact_id,
    mp.starts_at as occurred_at,
    nullif(trim(coalesce(mp.outcome_note, '')), '') as conversation
  from jasonos.meeting_preps mp
  where mp.live_ended_at is not null
),
ready as (
  select * from finished where contact_id is not null
),
numbered as (
  select
    r.*,
    row_number() over (
      partition by r.contact_id
      order by r.occurred_at asc, r.prep_id asc
    )::integer as touch_number
  from ready r
)
insert into jasonos.relationship_log (
  contact_id, prep_id, occurred_at, touch_number, conversation
)
select contact_id, prep_id, occurred_at, touch_number, conversation
from numbered n
where not exists (
  select 1 from jasonos.relationship_log rl where rl.prep_id = n.prep_id
);

-- Fill primary_contact_id when the attendee already has a contact
update jasonos.meeting_preps mp
set primary_contact_id = (
  select (att->>'contact_id')::uuid
  from jsonb_array_elements(coalesce(mp.attendees, '[]'::jsonb)) att
  where att ? 'contact_id'
    and nullif(att->>'contact_id', '') is not null
  limit 1
)
where mp.primary_contact_id is null
  and mp.live_ended_at is not null
  and exists (
    select 1
    from jsonb_array_elements(coalesce(mp.attendees, '[]'::jsonb)) att
    where att ? 'contact_id'
      and nullif(att->>'contact_id', '') is not null
  );

-- Refresh touch_count from the log
update jasonos.contacts c
set touch_count = coalesce(counts.n, 0)
from (
  select contact_id, count(*)::integer as n
  from jasonos.relationship_log
  group by contact_id
) counts
where c.id = counts.contact_id
  and c.touch_count is distinct from counts.n;

-- Contacts with log rows but no status: mark call_1 / call_2 / call_3 / ongoing
update jasonos.contacts c
set networking_status = case
  when c.touch_count = 1 then 'call_1'
  when c.touch_count = 2 then 'call_2'
  when c.touch_count = 3 then 'call_3'
  when c.touch_count > 3 then 'ongoing'
  else c.networking_status
end
where c.touch_count > 0
  and (c.networking_status is null or c.networking_status = 'first_contacted');

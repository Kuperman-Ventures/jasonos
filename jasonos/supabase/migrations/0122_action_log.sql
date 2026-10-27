-- Settings → Action Log. One row per decision Jason makes (snooze, skip,
-- done, dismiss, and the same kind of queue change). Sync that resolves a
-- follow-up on its own does not write here.
-- Service-role only.

set search_path = jasonos, public;

create table if not exists jasonos.action_log (
  id uuid primary key default gen_random_uuid(),
  acted_at timestamptz not null default now(),
  verb text not null,
  area text not null,
  subject text not null,
  detail text,
  actor text not null default 'jason' check (actor in ('jason', 'claude')),
  target_table text,
  target_id text
);

create index if not exists action_log_acted_at_idx
  on jasonos.action_log (acted_at desc);

comment on table jasonos.action_log is
  'Decisions Jason made in the app or via Claude. Settings → Action Log reads this.';

alter table jasonos.action_log enable row level security;

-- Current snoozes and scheduled email follow-ups are unambiguous user
-- decisions. Done and dismissed rows are not seeded: Sync writes those too
-- when an email already went out.
insert into jasonos.action_log (
  acted_at, verb, area, subject, detail, actor, target_table, target_id
)
select
  coalesce(m.decided_at, m.updated_at),
  'Snoozed',
  'Meeting follow-up',
  left(m.title, 300),
  case
    when m.snooze_until is null then null
    else
      (
        m.snooze_until
        - (timezone('America/New_York', coalesce(m.decided_at, m.updated_at)))::date
      )::text
      || case
        when (
          m.snooze_until
          - (timezone('America/New_York', coalesce(m.decided_at, m.updated_at)))::date
        ) = 1 then ' day · back '
        else ' days · back '
      end
      || to_char(m.snooze_until, 'Dy, Mon FMDD')
  end,
  'jason',
  'meeting_followups',
  m.id::text
from jasonos.meeting_followups m
where m.status = 'snoozed'
  and not exists (
    select 1
    from jasonos.action_log existing
    where existing.target_table = 'meeting_followups'
      and existing.target_id = m.id::text
      and existing.verb = 'Snoozed'
      and existing.acted_at = coalesce(m.decided_at, m.updated_at)
  );

insert into jasonos.action_log (
  acted_at, verb, area, subject, detail, actor, target_table, target_id
)
select
  coalesce(s.decided_at, s.updated_at),
  'Snoozed',
  'Email follow-up',
  left(coalesce(nullif(btrim(s.subject), ''), nullif(btrim(s.to_line), ''), 'Email'), 300),
  nullif(
    concat_ws(
      ' · ',
      case
        when s.follow_up_days is not null then
          s.follow_up_days::text
          || case when s.follow_up_days = 1 then ' day' else ' days' end
        else null
      end,
      case
        when s.follow_up_due is not null then 'due ' || to_char(s.follow_up_due, 'Dy, Mon FMDD')
        else null
      end,
      nullif(btrim(s.to_line), '')
    ),
    ''
  ),
  'jason',
  'sent_email_followups',
  s.id::text
from jasonos.sent_email_followups s
where s.status = 'scheduled'
  and not exists (
    select 1
    from jasonos.action_log existing
    where existing.target_table = 'sent_email_followups'
      and existing.target_id = s.id::text
      and existing.verb = 'Snoozed'
      and existing.acted_at = coalesce(s.decided_at, s.updated_at)
  );

insert into jasonos.action_log (
  acted_at, verb, area, subject, detail, actor, target_table, target_id
)
select
  s.updated_at,
  case s.state
    when 'done' then 'Done'
    when 'dismissed' then 'Not a commitment'
    when 'snoozed' then 'Snoozed'
    else s.state
  end,
  'Commitment',
  left(coalesce(nullif(btrim(item.elem->>'promise'), ''), s.item_key), 300),
  nullif(
    concat_ws(
      ' · ',
      case
        when s.state = 'snoozed' and s.snoozed_until is not null
          then 'until ' || to_char(s.snoozed_until, 'Dy, Mon FMDD')
        else null
      end,
      case
        when nullif(btrim(item.elem->>'to'), '') is not null
          then 'To ' || btrim(item.elem->>'to')
        else null
      end
    ),
    ''
  ),
  case when s.updated_by = 'claude' then 'claude' else 'jason' end,
  'commitment_item_states',
  s.item_key
from jasonos.commitment_item_states s
left join lateral (
  select elem
  from jasonos.commitment_checks c
  cross join lateral jsonb_array_elements(coalesce(c.payload->'items', '[]'::jsonb)) elem
  where elem->>'key' = s.item_key
  order by c.check_date desc
  limit 1
) item on true
where not exists (
  select 1
  from jasonos.action_log existing
  where existing.target_table = 'commitment_item_states'
    and existing.target_id = s.item_key
    and existing.acted_at = s.updated_at
);

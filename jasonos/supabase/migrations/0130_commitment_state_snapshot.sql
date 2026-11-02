-- Keep the promise text (and to / source link) on the state row so Done /
-- Dismissed / Scheduled survive Claude reminting a new key after the item is
-- stripped from the published payload.
alter table jasonos.commitment_item_states
  add column if not exists promise text,
  add column if not exists recipient text,
  add column if not exists source_url text;

comment on column jasonos.commitment_item_states.promise is
  'Snapshot of the commitment text when Jason marked it, for remint suppression.';
comment on column jasonos.commitment_item_states.recipient is
  'Snapshot of who it was promised to when Jason marked it.';
comment on column jasonos.commitment_item_states.source_url is
  'Snapshot of the source link when Jason marked it.';

-- Backfill from the action log (Done / Not a commitment / Scheduled).
update jasonos.commitment_item_states s
set
  promise = coalesce(s.promise, nullif(trim(a.subject), '')),
  recipient = coalesce(
    s.recipient,
    nullif(trim(regexp_replace(coalesce(a.detail, ''), '^.*\mTo\s+', '')), '')
  )
from (
  select distinct on (target_id)
    target_id,
    subject,
    detail
  from jasonos.action_log
  where target_table = 'commitment_item_states'
    and verb in ('Done', 'Not a commitment', 'Scheduled')
    and target_id is not null
  order by target_id, acted_at desc
) a
where s.item_key = a.target_id
  and (s.promise is null or s.recipient is null);

-- Backfill source_url (and any still-missing promise/to) from recent payloads.
update jasonos.commitment_item_states s
set
  promise = coalesce(s.promise, nullif(trim(p.promise), '')),
  recipient = coalesce(s.recipient, nullif(trim(p.recipient), '')),
  source_url = coalesce(s.source_url, nullif(trim(p.source_url), ''))
from (
  select distinct on (i.key)
    i.key,
    i.promise,
    i.recipient,
    i.source_url
  from jasonos.commitment_checks c
  cross join lateral (
    select
      e->>'key' as key,
      e->>'promise' as promise,
      e->>'to' as recipient,
      e->>'source_url' as source_url
    from jsonb_array_elements(c.payload->'items') e
  ) i
  where i.key is not null
  order by i.key, c.check_date desc
) p
where s.item_key = p.key
  and (s.promise is null or s.recipient is null or s.source_url is null);

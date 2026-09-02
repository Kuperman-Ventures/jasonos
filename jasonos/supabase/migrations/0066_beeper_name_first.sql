-- Beeper Suggested rows are name-first. Phone is optional extra data.
-- Also strip fake @beeper.invalid addresses that landed on People.

alter table jasonos.contact_candidates
  add column if not exists phone text;

update jasonos.contacts
set emails = coalesce((
  select array_agg(e)
  from unnest(emails) as e
  where e not ilike '%@beeper.invalid'
), '{}'::text[])
where exists (
  select 1 from unnest(emails) e where e ilike '%@beeper.invalid'
);

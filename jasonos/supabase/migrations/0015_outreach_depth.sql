-- 0015_outreach_depth.sql
-- ---------------------------------------------------------------------------
-- Phase 5A (Tier 1 + Tier 2 borrows from EncoreOS): add cadence stage
-- progression and per-touch outcome tracking so cadence advances only when
-- a goal is actually achieved (not just on activity).
--
-- Schema additions:
--   jasonos.contacts.cadence_stage          ('initial' | 'followup_1' | 'followup_2' | 'ongoing')
--   jasonos.contact_touches.objective_achieved ('yes' | 'no' | 'neutral')
--   jasonos.contact_touches.outcome         text (free-form post-touch note)
-- ---------------------------------------------------------------------------

set search_path = jasonos, public;

-- ---------- contacts.cadence_stage --------------------------------------

alter table jasonos.contacts
  add column if not exists cadence_stage text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contacts_cadence_stage_check'
      and conrelid = 'jasonos.contacts'::regclass
  ) then
    alter table jasonos.contacts
      add constraint contacts_cadence_stage_check
      check (cadence_stage is null or cadence_stage in ('initial','followup_1','followup_2','ongoing'));
  end if;
end $$;

-- Backfill: anyone with a non-null last_touch_date is at least 'initial'
update jasonos.contacts
   set cadence_stage = 'initial'
 where cadence_stage is null
   and last_touch_date is not null;

create index if not exists idx_contacts_cadence_stage
  on jasonos.contacts (cadence_stage)
  where cadence_stage is not null;

-- ---------- contact_touches.objective_achieved --------------------------

alter table jasonos.contact_touches
  add column if not exists objective_achieved text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contact_touches_objective_achieved_check'
      and conrelid = 'jasonos.contact_touches'::regclass
  ) then
    alter table jasonos.contact_touches
      add constraint contact_touches_objective_achieved_check
      check (objective_achieved is null or objective_achieved in ('yes','no','neutral'));
  end if;
end $$;

-- ---------- contact_touches.outcome -------------------------------------

alter table jasonos.contact_touches
  add column if not exists outcome text;

-- ---------- Helpful indexes for warmth-reminders queries ---------------

-- Surfaces "drift" — contacts whose last_touch_date is far behind cadence.
create index if not exists idx_contacts_warmth_scan
  on jasonos.contacts (last_touch_date)
  where cadence_interval is not null and cadence_interval <> 'none';

-- ---------- done ---------------------------------------------------------

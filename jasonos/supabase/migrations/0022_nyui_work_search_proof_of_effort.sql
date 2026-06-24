-- 0022_nyui_work_search_proof_of_effort.sql
-- ---------------------------------------------------------------------------
-- Strengthen the NYUI (NYS DOL) work-search proof-of-effort model. Purely
-- additive: new nullable columns on public.work_searches plus a
-- self-referential follow-up link. No existing column, table, or behavior
-- changes. Safe to re-run.
--
-- NOTE: The NYUI tables (work_searches, business_hours) live in the PUBLIC
-- schema (not jasonos) and are accessed via the service-role client in
-- lib/server-actions/nyui.ts. They were created directly in the Supabase
-- dashboard; this is the first migration to touch them.
--
-- New columns:
--   activity_tier      'employer_contact' (Tier A) | 'networking' (Tier B).
--                      Kept as free text to match the existing free-text
--                      contact_method / result columns (UI controls values).
--   outcome_next_step  free-text next action ("phone screen Jun 11", etc.).
--   next_contact_date  optional follow-up date.
--   parent_activity_id self-reference so one opportunity can chain multiple
--                      separately-creditable stage events.
-- ---------------------------------------------------------------------------

alter table public.work_searches
  add column if not exists activity_tier text,
  add column if not exists outcome_next_step text,
  add column if not exists next_contact_date date,
  add column if not exists parent_activity_id uuid;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'work_searches_parent_activity_id_fkey'
  ) then
    alter table public.work_searches
      add constraint work_searches_parent_activity_id_fkey
      foreign key (parent_activity_id) references public.work_searches(id) on delete set null;
  end if;
end $$;

create index if not exists work_searches_parent_activity_id_idx
  on public.work_searches(parent_activity_id);

-- Backfill tier for existing rows (networking-style methods -> Tier B, else Tier A).
update public.work_searches
set activity_tier = case
  when contact_method in ('LinkedIn','Networking Event','Networking Contact','Career-Center Advisor Meeting') then 'networking'
  else 'employer_contact'
end
where activity_tier is null;

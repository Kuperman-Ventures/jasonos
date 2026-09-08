-- Keep NYUI `result` in lockstep with Scoreboard `scoreboard_status`, and
-- link follow-up / duplicate work_searches rows for the same job so the
-- Scoreboard counts one application instead of two.

comment on column public.work_searches.scoreboard_status is
  'Scoreboard pipeline status: submitted / no_reply / next_steps / rejected / offer. Kept in sync with result.';

comment on column public.work_searches.result is
  'NYUI/DOL result. Updated when scoreboard_status changes so the two fields stay consistent.';

-- 1. Status wins when it is set (ServiceNow rejected + "Application Submitted", etc.).
update public.work_searches
set result = case scoreboard_status
  when 'rejected' then 'Rejected'
  when 'next_steps' then 'Interview Scheduled'
  when 'offer' then 'Offer Received'
  when 'submitted' then 'Application Submitted'
  when 'no_reply' then 'Pending'
  else result
end
where scoreboard_status is not null
  and result is distinct from case scoreboard_status
    when 'rejected' then 'Rejected'
    when 'next_steps' then 'Interview Scheduled'
    when 'offer' then 'Offer Received'
    when 'submitted' then 'Application Submitted'
    when 'no_reply' then 'Pending'
    else result
  end;

-- 2. Fill a missing scoreboard_status from result (Prolific: Rejected, status null).
update public.work_searches
set scoreboard_status = case result
  when 'Offer Received' then 'offer'
  when 'Rejected' then 'rejected'
  when 'Interview Scheduled' then 'next_steps'
  when 'Pending' then 'no_reply'
  when 'Application Submitted' then 'submitted'
  else 'submitted'
end
where scoreboard_status is null
  and (
    contact_method in ('Online Portal', 'Direct Email')
    or result in (
      'Application Submitted',
      'Rejected',
      'Offer Received',
      'Interview Scheduled',
      'Pending'
    )
  );

-- 3. Link later rows for the same company+role to the earliest application.
with application_rows as (
  select
    id,
    date,
    created_at,
    parent_activity_id,
    lower(trim(company_name)) as company_key,
    lower(trim(position_applied)) as role_key
  from public.work_searches
  where
    scoreboard_status is not null
    or contact_method in ('Online Portal', 'Direct Email')
    or result in (
      'Application Submitted',
      'Rejected',
      'Offer Received',
      'Interview Scheduled',
      'Pending'
    )
),
ranked as (
  select
    id,
    parent_activity_id,
    first_value(id) over (
      partition by company_key, role_key
      order by date asc, created_at asc
    ) as root_id
  from application_rows
)
update public.work_searches w
set parent_activity_id = ranked.root_id
from ranked
where w.id = ranked.id
  and ranked.root_id is distinct from w.id
  and w.parent_activity_id is null;

-- 4. Root row carries the latest pipeline outcome in the group (Nano Nuclear).
with group_latest as (
  select
    coalesce(parent_activity_id, id) as root_id,
    (array_agg(scoreboard_status order by date desc, created_at desc))[1] as latest_status
  from public.work_searches
  where scoreboard_status is not null
  group by 1
)
update public.work_searches w
set
  scoreboard_status = g.latest_status,
  result = case g.latest_status
    when 'rejected' then 'Rejected'
    when 'next_steps' then 'Interview Scheduled'
    when 'offer' then 'Offer Received'
    when 'submitted' then 'Application Submitted'
    when 'no_reply' then 'Pending'
    else w.result
  end
from group_latest g
where w.id = g.root_id
  and g.latest_status is not null
  and (
    w.scoreboard_status is distinct from g.latest_status
    or w.result is distinct from case g.latest_status
      when 'rejected' then 'Rejected'
      when 'next_steps' then 'Interview Scheduled'
      when 'offer' then 'Offer Received'
      when 'submitted' then 'Application Submitted'
      when 'no_reply' then 'Pending'
      else w.result
    end
  );

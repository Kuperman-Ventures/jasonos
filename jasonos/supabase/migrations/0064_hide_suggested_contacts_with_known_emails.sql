-- 0064_hide_suggested_contacts_with_known_emails.sql
-- Suggested Contacts must not include anyone whose exact email is already on
-- a jasonos.contacts row. Rows staged before the contact had that address
-- (or before the scan checked email) linger as status=new; mark them added.

update jasonos.contact_candidates as cand
set
  status = 'added',
  updated_at = now()
where cand.status = 'new'
  and exists (
    select 1
    from jasonos.contacts as c
    cross join unnest(coalesce(c.emails, '{}'::text[])) as e
    where lower(trim(e)) = lower(trim(cand.email))
       or lower(trim(both from split_part(split_part(e, '<', 2), '>', 1)))
          = lower(trim(cand.email))
  );

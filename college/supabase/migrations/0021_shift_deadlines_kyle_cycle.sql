-- Shift Common App-imported deadlines from the 2026-27 (senior) cycle
-- into Kyle's 2027-28 application cycle (Fall 2028 enrollment).
-- Month/day stay the same; year advances by one.

update college.deadlines
set due_date = (due_date + interval '1 year')::date
where due_date is not null
  and due_date >= date '2026-08-01'
  and due_date < date '2027-08-01';

update college.schools
set deadline = (deadline + interval '1 year')::date,
    updated_at = now()
where deadline is not null
  and deadline >= date '2026-08-01'
  and deadline < date '2027-08-01';

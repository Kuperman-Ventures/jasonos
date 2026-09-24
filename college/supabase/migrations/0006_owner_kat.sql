-- Step owner label: Wife -> Kat
update college.school_steps set owner = 'kat' where owner = 'wife';
alter table college.school_steps drop constraint if exists school_steps_owner_check;
alter table college.school_steps add constraint school_steps_owner_check
  check (owner in ('kyle', 'jason', 'kat'));

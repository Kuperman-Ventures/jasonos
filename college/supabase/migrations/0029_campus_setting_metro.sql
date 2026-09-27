-- Campus Setting + metro fields; retire free-text campus_size.
alter table college.schools
  add column if not exists campus_setting text not null default '',
  add column if not exists metro_area text,
  add column if not exists metro_population integer;

comment on column college.schools.campus_setting is
  'Urban | Suburban | Small city | College town | Small town.';
comment on column college.schools.metro_area is
  'Census MSA name; null for College town and Small town.';
comment on column college.schools.metro_population is
  'Census MSA population estimate; null for College town and Small town.';

-- Values are imported by name in the follow-on data migration
-- (applied live via campus_setting_metro + SQL updates). Keep this file as the
-- schema contract for fresh environments; production already has the data.
alter table college.schools drop column if exists campus_size;

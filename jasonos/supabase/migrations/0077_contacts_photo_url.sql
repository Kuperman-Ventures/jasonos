-- Contact profile photos pulled from LeadDelta (LinkedIn CRM), not scraped.
-- photo_url is a remote image URL; photo_source records where it came from.

set search_path = jasonos, public;

alter table jasonos.contacts
  add column if not exists photo_url text,
  add column if not exists photo_source text,
  add column if not exists photo_updated_at timestamptz;

comment on column jasonos.contacts.photo_url is
  'Remote profile image URL (LeadDelta / LinkedIn CRM). Not scraped from LinkedIn.';
comment on column jasonos.contacts.photo_source is
  'Where photo_url was loaded from, e.g. leaddelta.';

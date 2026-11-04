-- Optional bold opening phrase on a webinar takeaway.

set search_path = jasonos, public;

alter table jasonos.webinar_takeaways
  add column if not exists lead text not null default '';

comment on column jasonos.webinar_takeaways.lead is
  'Short bold opening phrase shown before the takeaway text, written by the publisher. Optional.';

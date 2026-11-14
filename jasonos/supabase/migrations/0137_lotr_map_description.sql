-- Update LOTR project card copy for the Middle-earth map page.

set search_path = jasonos, public;

update jasonos.project_pages
set
  description = 'Map of Middle-earth with key locations and scene highlights.',
  updated_at = now()
where slug = 'lotr';

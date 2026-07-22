-- Let a customized resume be removed from the NYUI "to log" queue without
-- logging it as a work search (e.g. it wasn't actually submitted).
alter table jasonos.resume_customizations
  add column if not exists nyui_dismissed_at timestamptz;

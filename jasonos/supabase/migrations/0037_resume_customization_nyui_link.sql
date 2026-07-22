-- Tie resume customizations into NYUI: each tailored resume is a job
-- application that can be logged as an NYS DOL work search. When logged, we
-- stamp nyui_logged_at so it drops out of the "to log" queue.
alter table jasonos.resume_customizations
  add column if not exists nyui_logged_at timestamptz;

-- 0054_rename_post_machine_to_post_master.sql
-- ---------------------------------------------------------------------------
-- Feature rename: Post Machine → Post Master.
-- Keeps existing saved projects by renaming the table in place.
-- ---------------------------------------------------------------------------

alter table if exists jasonos.post_machine_projects
  rename to post_master_projects;

alter index if exists jasonos.post_machine_projects_updated_idx
  rename to post_master_projects_updated_idx;

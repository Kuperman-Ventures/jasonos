-- 0059_sync_log_run_id.sql
-- Group Gmail / Calendar / Beeper / Suggested rows from one Sync click.

alter table jasonos.sync_log
  add column if not exists run_id uuid;

create index if not exists sync_log_run_id_idx
  on jasonos.sync_log (run_id, ran_at desc);

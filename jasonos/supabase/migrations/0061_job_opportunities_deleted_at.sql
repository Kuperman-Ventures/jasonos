-- 0061_job_opportunities_deleted_at.sql
-- ---------------------------------------------------------------------------
-- Job Alerts listings stay until Jason deletes them. Sync only adds / updates.
-- Soft-delete so a later harvest of the same fingerprint does not resurrect it.
-- ---------------------------------------------------------------------------

alter table jasonos.job_opportunities
  add column if not exists deleted_at timestamptz;

create index if not exists job_opportunities_active_received_idx
  on jasonos.job_opportunities (received_at desc)
  where deleted_at is null;

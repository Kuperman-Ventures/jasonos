-- 0028_resume_customizations_versioning.sql
-- ---------------------------------------------------------------------------
-- Support "Regenerate" (re-run the tailoring on the same JD → new versioned
-- file) and per-company versioning of tailored resumes.
--   • job_description: the JD text used, so a customization can be regenerated
--     without re-uploading the posting.
--   • version: 1 for the first tailored resume for a company; 2, 3, … for each
--     regeneration/re-run (drives the "Company - Resume v2.docx" filename).
-- ---------------------------------------------------------------------------

alter table jasonos.resume_customizations
  add column if not exists job_description text;

alter table jasonos.resume_customizations
  add column if not exists version integer not null default 1;

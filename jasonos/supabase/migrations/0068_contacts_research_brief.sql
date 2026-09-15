-- Person/company research briefs used to live only on jasonos.meetings, so you
-- had to schedule a meeting before you could run the web search. Store the
-- same brief on the contact so it can be run (and reused) with no meeting.
alter table jasonos.contacts
  add column if not exists research_brief text,
  add column if not exists research_at timestamptz;

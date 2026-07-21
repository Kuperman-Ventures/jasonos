-- Add an optional phone number to contacts so it can be captured and edited
-- from the contact detail card alongside name, firm, and email.
alter table jasonos.contacts
  add column if not exists phone text;

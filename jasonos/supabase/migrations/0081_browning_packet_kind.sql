-- Resume packets: Tracy sends names, LinkedIn, and Word docs without
-- copying the contact. One email can name more than one person.

set search_path = jasonos, public;

alter table jasonos.browning_handoffs
  add column if not exists source_kind text not null default 'intro';

alter table jasonos.browning_handoffs
  drop constraint if exists browning_handoffs_source_kind_check;

alter table jasonos.browning_handoffs
  add constraint browning_handoffs_source_kind_check check (
    source_kind in ('intro', 'packet')
  );

alter table jasonos.browning_handoffs
  drop constraint if exists browning_handoffs_gmail_account_gmail_message_id_key;

drop index if exists jasonos.browning_handoffs_message_person_key;

create unique index browning_handoffs_message_person_key
  on jasonos.browning_handoffs (
    gmail_account,
    gmail_message_id,
    lower(coalesce(contact_name, ''))
  );

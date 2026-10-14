-- Library: messages Jason has already sent, kept so he can find and reuse them.
-- Service-role only, same arrangement as the other JasonOS tables.
-- No anon/authenticated policies. 0087 revoked those roles by default.

set search_path = jasonos, public;

create table if not exists jasonos.library_kinds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  constraint library_kinds_name_key unique (name)
);

create unique index if not exists library_kinds_name_lower_idx
  on jasonos.library_kinds (lower(name));

comment on table jasonos.library_kinds is
  'Labels for library messages (Introduction, Follow-up, and kinds Jason adds).';

insert into jasonos.library_kinds (name)
values
  ('Introduction'),
  ('Forwardable note'),
  ('Thank-you'),
  ('Follow-up'),
  ('Referral ask')
on conflict (name) do nothing;

create table if not exists jasonos.library_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  channel text not null,
  subject text,
  kind text,
  company text,
  contact_ids uuid[] not null default '{}',
  sent_on date not null default current_date,
  copy_count int not null default 0,
  last_copied_at timestamptz,
  body_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_items_channel_check check (channel in ('email', 'linkedin', 'text')),
  constraint library_items_copy_count_check check (copy_count >= 0)
);

create index if not exists library_items_sent_idx
  on jasonos.library_items (sent_on desc, created_at desc);

create index if not exists library_items_body_hash_idx
  on jasonos.library_items (body_hash);

create index if not exists library_items_contact_ids_idx
  on jasonos.library_items using gin (contact_ids);

comment on table jasonos.library_items is
  'Sent messages saved for reuse. body is stored as pasted (newlines normalized). body_hash warns on duplicates.';

comment on column jasonos.library_items.sent_on is
  'The date shown in the Library and used for sorting. Editable.';

comment on column jasonos.library_items.body_hash is
  'sha256 of the body after CRLF normalization and trimming leading and trailing whitespace.';

drop trigger if exists library_items_set_updated_at on jasonos.library_items;
create trigger library_items_set_updated_at
  before update on jasonos.library_items
  for each row execute function jasonos.set_updated_at();

alter table jasonos.library_kinds enable row level security;
alter table jasonos.library_items enable row level security;

revoke all on table jasonos.library_kinds from anon, authenticated;
revoke all on table jasonos.library_items from anon, authenticated;

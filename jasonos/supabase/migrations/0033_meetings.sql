-- Meetings: a lightweight prep → held → debrief record for a single contact.
-- Powers the contact card's Meeting tab (prepare before, debrief after) and the
-- "scheduled vs held" gradation in the networking funnel. When a meeting is
-- marked held it also writes a conversation touch so it flows into the existing
-- activity heatmap and funnel.
create table if not exists jasonos.meetings (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references jasonos.contacts(id) on delete cascade,
  scheduled_at timestamptz not null,
  channel text not null default 'video', -- call | video | in_person | coffee_chat
  status text not null default 'scheduled', -- scheduled | held | cancelled
  prep_goal text,
  prep_notes text,
  debrief_notes text,
  objective_achieved text, -- yes | no | neutral
  thank_you_sent boolean not null default false,
  next_step text,
  held_at timestamptz,
  linked_touch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_meetings_contact on jasonos.meetings (contact_id);
create index if not exists idx_meetings_scheduled on jasonos.meetings (scheduled_at);

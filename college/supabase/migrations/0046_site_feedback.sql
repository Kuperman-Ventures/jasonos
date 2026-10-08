-- Household feature requests and feedback for the college portal.

create table if not exists college.site_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  member_id text not null,
  member_name text not null,
  kind text not null check (kind in ('bug', 'idea', 'question')),
  body text not null,
  page_tab text,
  school_id text,
  school_name text,
  status text not null default 'new'
    check (status in ('new', 'planned', 'done', 'wont')),
  admin_note text not null default ''
);

create index if not exists site_feedback_created_at_idx
  on college.site_feedback (created_at desc);

create index if not exists site_feedback_member_id_idx
  on college.site_feedback (member_id, created_at desc);

create index if not exists site_feedback_status_idx
  on college.site_feedback (status, created_at desc);

comment on table college.site_feedback is
  'Feature requests, bugs, and questions from household members. Written via /api/feedback; Admin updates status.';

alter table college.site_feedback enable row level security;
revoke all on table college.site_feedback from public, anon, authenticated;
grant all on table college.site_feedback to service_role;

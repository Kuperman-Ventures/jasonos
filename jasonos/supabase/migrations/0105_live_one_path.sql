-- Live one path: plan build timestamp + constrained plan_source values.
set search_path = jasonos, public;

alter table jasonos.meeting_preps
  add column if not exists plan_built_at timestamptz;

-- plan_source already exists (0101). Normalize legacy Browning value, then constrain.
update jasonos.meeting_preps
set plan_source = 'playbook'
where plan_source = 'browning_auto';

alter table jasonos.meeting_preps
  drop constraint if exists meeting_preps_plan_source_check;

alter table jasonos.meeting_preps
  add constraint meeting_preps_plan_source_check
  check (plan_source is null or plan_source in ('playbook', 'guide', 'blank', 'chat'));

comment on column jasonos.meeting_preps.plan_source is
  'How the plan was built: from a playbook, from a guide, from nothing, or written through the MCP by Claude.';

comment on column jasonos.meeting_preps.plan_built_at is
  'When the meeting plan was last written (Build plan, guide use, blank draft, chat, or accepted playbook).';

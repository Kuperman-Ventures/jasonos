-- Per-connection on/off. Off connections are skipped on Sync / Check All
-- so unused services do not show as disconnected or errored.

alter table public.service_connections
  add column if not exists enabled boolean not null default true;

alter table public.service_connections
  drop constraint if exists service_connections_status_check;

alter table public.service_connections
  add constraint service_connections_status_check
  check (status in ('connected', 'not_configured', 'error', 'expired', 'disabled'));

create index if not exists idx_service_connections_user_enabled
  on public.service_connections(user_id, enabled);

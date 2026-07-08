create table if not exists integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  provider text not null,
  category text not null,
  status text not null default 'not_configured',
  auth_type text not null default 'oauth',
  scopes text[] not null default '{}',
  health_status text not null default 'unknown',
  last_checked_at timestamptz,
  last_error text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create table if not exists integration_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  connection_id uuid not null references integration_connections(id) on delete cascade,
  event_type text not null,
  outcome text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_integration_connections_org_status on integration_connections(organization_id, status, provider);
create index if not exists idx_integration_events_connection on integration_events(connection_id, created_at desc);

create table if not exists automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  trigger_event text not null,
  condition_field text not null default 'event.type',
  condition_operator text not null default 'equals',
  condition_value text not null,
  action_type text not null,
  action_config jsonb not null default '{}'::jsonb,
  run_count integer not null default 0,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists automation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  rule_id uuid not null references automation_rules(id) on delete cascade,
  event_type text not null,
  outcome text not null,
  resource_type text,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_automation_rules_org_trigger on automation_rules(organization_id, status, trigger_event);
create index if not exists idx_automation_runs_org_time on automation_runs(organization_id, created_at desc);

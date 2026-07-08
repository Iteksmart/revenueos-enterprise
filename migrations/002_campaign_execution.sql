create table if not exists campaign_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  campaign_id uuid not null references marketing_campaigns(id) on delete cascade,
  step_order integer not null,
  trigger_type text not null,
  action_type text not null,
  channel text not null,
  delay_days integer not null default 0,
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz not null default now(),
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, step_order)
);

create table if not exists notification_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  campaign_id uuid references marketing_campaigns(id) on delete cascade,
  step_id uuid references campaign_steps(id) on delete set null,
  channel text not null,
  recipient text not null,
  subject text not null,
  body text not null,
  status text not null default 'queued',
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_campaign_steps_campaign on campaign_steps(campaign_id, step_order);
create index if not exists idx_campaign_steps_status on campaign_steps(organization_id, status, scheduled_at);
create index if not exists idx_notification_outbox_status on notification_outbox(organization_id, status, scheduled_at);

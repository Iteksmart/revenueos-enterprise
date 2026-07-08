create table if not exists customer_success_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  company_id uuid not null references crm_companies(id) on delete cascade,
  mrr numeric(14,2) not null default 0,
  arr numeric(14,2) generated always as (mrr * 12) stored,
  health_status text not null default 'stable',
  onboarding_status text not null default 'not_started',
  renewal_date date,
  renewal_risk integer not null default 50 check (renewal_risk between 0 and 100),
  executive_sponsor text,
  success_plan text not null default '',
  last_touch_at timestamptz,
  next_review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, company_id)
);

create table if not exists customer_success_touchpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  account_id uuid not null references customer_success_accounts(id) on delete cascade,
  touchpoint_type text not null,
  summary text not null,
  sentiment text not null default 'neutral',
  next_action text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists customer_portal_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  account_id uuid not null references customer_success_accounts(id) on delete cascade,
  item_type text not null,
  title text not null,
  status text not null default 'open',
  due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_success_accounts_org_health on customer_success_accounts(organization_id, health_status, renewal_date);
create index if not exists idx_customer_success_touchpoints_account on customer_success_touchpoints(account_id, occurred_at desc);
create index if not exists idx_customer_portal_items_account on customer_portal_items(account_id, item_type, status);

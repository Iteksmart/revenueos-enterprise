create extension if not exists "pgcrypto";

create table if not exists revenueos_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists revenueos_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  external_subject text not null,
  email text not null,
  display_name text not null,
  mfa_enrolled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, external_subject)
);

create table if not exists revenueos_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  name text not null,
  permissions text[] not null default '{}',
  unique (organization_id, name)
);

create table if not exists revenueos_user_roles (
  user_id uuid not null references revenueos_users(id) on delete cascade,
  role_id uuid not null references revenueos_roles(id) on delete cascade,
  primary key (user_id, role_id)
);

create table if not exists crm_companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  name text not null,
  domain text,
  industry text,
  employee_count integer,
  annual_revenue numeric(14,2),
  lifecycle_stage text not null default 'prospect',
  owner_user_id uuid references revenueos_users(id) on delete set null,
  health_score integer not null default 50 check (health_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, domain)
);

create table if not exists crm_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  company_id uuid references crm_companies(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  title text,
  authority_level integer not null default 50 check (authority_level between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);

create table if not exists crm_deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  company_id uuid not null references crm_companies(id) on delete cascade,
  primary_contact_id uuid references crm_contacts(id) on delete set null,
  name text not null,
  stage text not null,
  amount numeric(14,2) not null default 0,
  probability integer not null default 10 check (probability between 0 and 100),
  close_date date,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists crm_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  company_id uuid references crm_companies(id) on delete cascade,
  deal_id uuid references crm_deals(id) on delete cascade,
  assigned_user_id uuid references revenueos_users(id) on delete set null,
  title text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists crm_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  company_id uuid references crm_companies(id) on delete cascade,
  deal_id uuid references crm_deals(id) on delete cascade,
  contact_id uuid references crm_contacts(id) on delete set null,
  activity_type text not null,
  summary text not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists crm_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  company_id uuid references crm_companies(id) on delete cascade,
  deal_id uuid references crm_deals(id) on delete cascade,
  author_user_id uuid references revenueos_users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists crm_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  company_id uuid references crm_companies(id) on delete cascade,
  deal_id uuid references crm_deals(id) on delete cascade,
  document_type text not null,
  storage_key text not null,
  sha256 text,
  created_at timestamptz not null default now()
);

create table if not exists crm_quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  deal_id uuid not null references crm_deals(id) on delete cascade,
  quote_number text not null,
  status text not null default 'draft',
  subtotal numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) generated always as (subtotal + tax) stored,
  created_at timestamptz not null default now(),
  unique (organization_id, quote_number)
);

create table if not exists crm_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  quote_id uuid references crm_quotes(id) on delete set null,
  invoice_number text not null,
  status text not null default 'draft',
  total numeric(14,2) not null default 0,
  due_date date,
  created_at timestamptz not null default now(),
  unique (organization_id, invoice_number)
);

create table if not exists marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  name text not null,
  segment text not null,
  status text not null default 'draft',
  cadence_days integer not null default 14,
  consent_policy text not null default 'business-context-only',
  created_at timestamptz not null default now()
);

create table if not exists lead_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  company_id uuid not null references crm_companies(id) on delete cascade,
  fit_score integer not null check (fit_score between 0 and 100),
  intent_score integer not null check (intent_score between 0 and 100),
  behavior_score integer not null check (behavior_score between 0 and 100),
  budget_score integer not null check (budget_score between 0 and 100),
  authority_score integer not null check (authority_score between 0 and 100),
  urgency_score integer not null check (urgency_score between 0 and 100),
  overall_score integer not null check (overall_score between 0 and 100),
  explanation text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_log_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references revenueos_organizations(id) on delete set null,
  actor_subject text,
  action text not null,
  resource_type text not null,
  resource_id text,
  purpose text not null,
  outcome text not null,
  request_id text,
  ip_hash text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_companies_org on crm_companies(organization_id, updated_at desc);
create index if not exists idx_crm_contacts_company on crm_contacts(company_id);
create index if not exists idx_crm_deals_org_stage on crm_deals(organization_id, stage);
create index if not exists idx_crm_tasks_due on crm_tasks(organization_id, status, due_at);
create index if not exists idx_audit_org_time on audit_log_events(organization_id, created_at desc);

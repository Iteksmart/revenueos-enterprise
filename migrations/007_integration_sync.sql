create table if not exists integration_external_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  provider text not null,
  external_id text not null,
  record_type text not null,
  crm_company_id uuid references crm_companies(id) on delete set null,
  crm_contact_id uuid references crm_contacts(id) on delete set null,
  source_payload jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, provider, external_id, record_type)
);

create index if not exists idx_integration_external_records_org_provider
  on integration_external_records(organization_id, provider, record_type, last_seen_at desc);

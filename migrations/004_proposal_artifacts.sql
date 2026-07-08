create table if not exists proposal_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references revenueos_organizations(id) on delete cascade,
  deal_id uuid not null references crm_deals(id) on delete cascade,
  quote_id uuid references crm_quotes(id) on delete set null,
  title text not null,
  status text not null default 'draft',
  version integer not null default 1,
  offer text not null,
  terms text not null,
  proposal_body text not null,
  generated_by text not null default 'revenueos-ai',
  viewed_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_proposal_artifacts_org_status on proposal_artifacts(organization_id, status, updated_at desc);
create index if not exists idx_proposal_artifacts_deal on proposal_artifacts(deal_id, version desc);

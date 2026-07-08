"use client";

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { FormEvent, useEffect, useMemo, useState } from "react";

type ApiResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

type BootstrapData = {
  created?: boolean;
  user_id?: string;
  userId?: string;
  organization_id?: string;
  organizationId?: string;
  organization_name?: string;
  organizationName?: string;
  domain?: string | null;
  roles?: string[];
  permissions?: string[];
};

type Company = {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employee_count: number | null;
  annual_revenue: string | null;
  lifecycle_stage: string;
  health_score: number;
  updated_at: string;
};

type Campaign = {
  id: string;
  name: string;
  segment: string;
  status: string;
  cadence_days: number;
  consent_policy: string;
  created_at: string;
};

const companySeeds = [
  {
    name: "ABC Medical",
    domain: "abcmedical.example",
    industry: "Healthcare",
    employeeCount: 50,
    annualRevenue: 6800000,
    lifecycleStage: "meeting-today",
    healthScore: 91,
  },
  {
    name: "Smith Law",
    domain: "smithlaw.example",
    industry: "Legal",
    employeeCount: 28,
    annualRevenue: 4200000,
    lifecycleStage: "proposal-viewed",
    healthScore: 87,
  },
  {
    name: "City of Savannah",
    domain: "savannahcity.example",
    industry: "Government",
    employeeCount: 420,
    annualRevenue: 0,
    lifecycleStage: "security-review",
    healthScore: 83,
  },
];

export function RevenueOSWorkspace() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return (
      <main className="workspace-page">
        <section className="workspace-auth">
          <p className="rev-kicker">RevenueOS Enterprise</p>
          <h1>Loading workspace.</h1>
          <p>Checking the active Clerk session.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="workspace-page">
      {!isSignedIn ? (
        <section className="workspace-auth">
          <p className="rev-kicker">RevenueOS Enterprise</p>
          <h1>Sign in to activate the operating layer.</h1>
          <p>RevenueOS needs a Clerk session before it can create the first organization, Owner role, audit trail, and CRM records.</p>
          <SignInButton mode="redirect" fallbackRedirectUrl="/app">
            <button type="button">Sign in</button>
          </SignInButton>
        </section>
      ) : (
        <WorkspaceShell />
      )}
    </main>
  );
}

function WorkspaceShell() {
  const { user } = useUser();
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [status, setStatus] = useState("Checking RevenueOS membership...");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    domain: "",
    industry: "Healthcare",
    employeeCount: "50",
    annualRevenue: "5000000",
    healthScore: "82",
  });

  const organizationName = bootstrap?.organizationName ?? bootstrap?.organization_name ?? "Not bootstrapped";
  const organizationId = bootstrap?.organizationId ?? bootstrap?.organization_id;
  const ownerReady = Boolean(organizationId);
  const totalPipeline = useMemo(() => companies.reduce((sum, company) => sum + Number(company.annual_revenue ?? 0), 0), [companies]);

  useEffect(() => {
    void refreshMembership();
  }, []);

  async function refreshMembership() {
    setError(null);
    const result = await apiGet<BootstrapData | null>("/api/bootstrap");
    if (!result.ok) {
      setStatus(result.error ?? "RevenueOS membership check failed.");
      return;
    }

    setBootstrap(result.data ?? null);
    if (result.data) {
      setStatus("RevenueOS Owner workspace is active.");
      await Promise.all([loadCompanies(), loadCampaigns()]);
    } else {
      setStatus("No RevenueOS organization is linked to this Clerk user yet.");
    }
  }

  async function bootstrapWorkspace() {
    setIsBusy(true);
    setError(null);
    try {
      const result = await apiPost<BootstrapData>("/api/bootstrap", {
        organizationName: "iTechSmart RevenueOS",
        domain: user?.primaryEmailAddress?.emailAddress?.split("@")[1] ?? "itechsmart.dev",
      });
      if (!result.ok) {
        throw new Error(result.error ?? "Bootstrap failed.");
      }
      setBootstrap(result.data ?? null);
      setStatus(result.data?.created ? "RevenueOS organization and Owner role created." : "Existing RevenueOS Owner workspace loaded.");
      await Promise.all([loadCompanies(), loadCampaigns()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Bootstrap failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function seedWorkspace() {
    setIsBusy(true);
    setError(null);
    try {
      for (const company of companySeeds) {
        const result = await apiPost<Company>("/api/crm/companies", company);
        if (!result.ok) {
          throw new Error(result.error ?? `Could not create ${company.name}.`);
        }
      }
      const campaign = await apiPost<Campaign>("/api/campaigns", {
        name: "Healthcare Accountability Campaign",
        segment: "Healthcare organizations without an MSP accountability layer",
        status: "approved",
        cadenceDays: 14,
        consentPolicy: "business-context-only",
      });
      if (!campaign.ok) {
        throw new Error(campaign.error ?? "Could not create campaign.");
      }
      setStatus("CRM proof data created with audit events.");
      await Promise.all([loadCompanies(), loadCampaigns()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Seed failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      const result = await apiPost<Company>("/api/crm/companies", {
        name: form.name,
        domain: form.domain || null,
        industry: form.industry || null,
        employeeCount: Number(form.employeeCount),
        annualRevenue: Number(form.annualRevenue),
        lifecycleStage: "prospect",
        healthScore: Number(form.healthScore),
      });
      if (!result.ok) {
        throw new Error(result.error ?? "Could not create company.");
      }
      setForm((current) => ({ ...current, name: "", domain: "" }));
      setStatus(`${result.data?.name ?? "Company"} saved to CRM.`);
      await loadCompanies();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create company.");
    } finally {
      setIsBusy(false);
    }
  }

  async function loadCompanies() {
    const result = await apiGet<Company[]>("/api/crm/companies");
    if (result.ok) {
      setCompanies(result.data ?? []);
    } else {
      setError(result.error ?? "Could not load companies.");
    }
  }

  async function loadCampaigns() {
    const result = await apiGet<Campaign[]>("/api/campaigns");
    if (result.ok) {
      setCampaigns(result.data ?? []);
    }
  }

  return (
    <section className="workspace-shell">
      <header className="workspace-command">
        <div>
          <p className="rev-kicker">RevenueOS Live Workspace</p>
          <h1>Good morning Kevin.</h1>
          <p>{status}</p>
        </div>
        <div className="workspace-user">
          <span>{user?.primaryEmailAddress?.emailAddress ?? "Signed in"}</span>
          <UserButton />
        </div>
      </header>

      {error ? <div className="workspace-alert">{error}</div> : null}

      <section className="workspace-metrics" aria-label="Live workspace metrics">
        <Metric label="Organization" value={organizationName} detail={organizationId ? organizationId.slice(0, 8) : "Setup required"} />
        <Metric label="Companies" value={companies.length.toString()} detail="Database-backed CRM" />
        <Metric label="Pipeline Signal" value={formatCurrency(totalPipeline)} detail="Annual revenue field" />
        <Metric label="Campaigns" value={campaigns.length.toString()} detail="Consent policy logged" />
      </section>

      <section className="workspace-grid">
        <article className="workspace-panel workspace-setup">
          <div className="rev-panel-head">
            <div>
              <p className="rev-kicker">Step 01</p>
              <h2>Owner Bootstrap</h2>
            </div>
            <span className={`rev-pill ${ownerReady ? "success" : "warning"}`}>{ownerReady ? "Ready" : "Needs setup"}</span>
          </div>
          <p>Create the first RevenueOS organization, user, Owner role, permissions, and audit event for this Clerk session.</p>
          <button type="button" onClick={bootstrapWorkspace} disabled={isBusy}>
            {ownerReady ? "Refresh Owner Link" : "Create Owner Workspace"}
          </button>
        </article>

        <article className="workspace-panel workspace-setup">
          <div className="rev-panel-head">
            <div>
              <p className="rev-kicker">Step 02</p>
              <h2>CRM Proof Data</h2>
            </div>
            <span className="rev-pill">Audit logged</span>
          </div>
          <p>Seed the first healthcare, legal, and government targets plus an approved nurture campaign.</p>
          <button type="button" onClick={seedWorkspace} disabled={isBusy || !ownerReady}>
            Seed RevenueOS CRM
          </button>
        </article>

        <article className="workspace-panel workspace-wide">
          <div className="rev-panel-head">
            <div>
              <p className="rev-kicker">CRM Command</p>
              <h2>Create Company</h2>
            </div>
            <span className="rev-pill success">Live API</span>
          </div>
          <form className="workspace-form" onSubmit={createCompany}>
            <label>
              Company
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength={2} />
            </label>
            <label>
              Domain
              <input value={form.domain} onChange={(event) => setForm({ ...form, domain: event.target.value })} placeholder="example.com" />
            </label>
            <label>
              Industry
              <input value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} />
            </label>
            <label>
              Employees
              <input type="number" value={form.employeeCount} onChange={(event) => setForm({ ...form, employeeCount: event.target.value })} min={1} />
            </label>
            <label>
              Annual revenue
              <input type="number" value={form.annualRevenue} onChange={(event) => setForm({ ...form, annualRevenue: event.target.value })} min={0} />
            </label>
            <label>
              Health
              <input type="number" value={form.healthScore} onChange={(event) => setForm({ ...form, healthScore: event.target.value })} min={0} max={100} />
            </label>
            <button type="submit" disabled={isBusy || !ownerReady}>Save Company</button>
          </form>
        </article>

        <article className="workspace-panel workspace-wide">
          <div className="rev-panel-head">
            <div>
              <p className="rev-kicker">Companies</p>
              <h2>Database Records</h2>
            </div>
            <span className="rev-pill">{companies.length} rows</span>
          </div>
          <div className="rev-table-wrap">
            <table className="rev-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Domain</th>
                  <th>Industry</th>
                  <th>Employees</th>
                  <th>Revenue</th>
                  <th>Health</th>
                  <th>Stage</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id}>
                    <td>{company.name}</td>
                    <td>{company.domain ?? "-"}</td>
                    <td>{company.industry ?? "-"}</td>
                    <td>{company.employee_count ?? "-"}</td>
                    <td>{formatCurrency(Number(company.annual_revenue ?? 0))}</td>
                    <td><span className="rev-score">{company.health_score}</span></td>
                    <td>{company.lifecycle_stage}</td>
                  </tr>
                ))}
                {companies.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No CRM companies yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  const response = await fetch(path, { credentials: "same-origin" });
  return response.json();
}

async function apiPost<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

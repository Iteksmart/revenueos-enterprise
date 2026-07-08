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

type Deal = {
  id: string;
  company_id: string;
  company_name?: string;
  name: string;
  stage: string;
  amount: string;
  probability: number;
  close_date: string | null;
  source: string | null;
  created_at: string;
};

type Task = {
  id: string;
  company_id: string | null;
  deal_id: string | null;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  created_at: string;
};

type LeadScore = {
  id: string;
  company_id: string;
  company_name: string;
  fit_score: number;
  intent_score: number;
  behavior_score: number;
  budget_score: number;
  authority_score: number;
  urgency_score: number;
  overall_score: number;
  explanation: string;
  created_at: string;
};

type AuditEvent = {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  purpose: string;
  outcome: string;
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

const dealSeeds = [
  { company: "ABC Medical", name: "Managed IT Accountability Layer", stage: "meeting", amount: 42000, probability: 72, source: "healthcare-campaign" },
  { company: "Smith Law", name: "ProofLink Compliance Proposal", stage: "proposal", amount: 28000, probability: 68, source: "legal-referral" },
  { company: "City of Savannah", name: "Municipal Security Operations Review", stage: "security-review", amount: 64000, probability: 54, source: "government" },
];

const taskSeeds = [
  { company: "ABC Medical", title: "Call ABC Medical before noon", priority: "urgent" },
  { company: "Smith Law", title: "Send ProofLink proposal packet", priority: "high" },
  { company: "City of Savannah", title: "Prepare security questionnaire response", priority: "high" },
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
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leadScores, setLeadScores] = useState<LeadScore[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [aiOutput, setAiOutput] = useState("AI outputs will appear here after you run meeting prep or proposal generation.");
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
  const weightedPipeline = useMemo(
    () => deals.reduce((sum, deal) => sum + (Number(deal.amount ?? 0) * deal.probability) / 100, 0),
    [deals],
  );
  const openTaskCount = tasks.filter((task) => task.status !== "done").length;

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
      await loadWorkspaceData();
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
      await loadWorkspaceData();
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
      const createdCompanies: Company[] = [];
      for (const company of companySeeds) {
        const result = await apiPost<Company>("/api/crm/companies", company);
        if (!result.ok) {
          throw new Error(result.error ?? `Could not create ${company.name}.`);
        }
        if (result.data) {
          createdCompanies.push(result.data);
        }
      }

      const companiesByName = new Map(createdCompanies.map((company) => [company.name, company]));
      for (const deal of dealSeeds) {
        const company = companiesByName.get(deal.company);
        if (!company) {
          continue;
        }
        const result = await apiPost<Deal>("/api/crm/deals", {
          companyId: company.id,
          name: deal.name,
          stage: deal.stage,
          amount: deal.amount,
          probability: deal.probability,
          closeDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10),
          source: deal.source,
        });
        if (!result.ok) {
          throw new Error(result.error ?? `Could not create deal for ${deal.company}.`);
        }
      }

      for (const task of taskSeeds) {
        const company = companiesByName.get(task.company);
        const result = await apiPost<Task>("/api/crm/tasks", {
          companyId: company?.id ?? null,
          title: task.title,
          status: "open",
          priority: task.priority,
          dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        });
        if (!result.ok) {
          throw new Error(result.error ?? `Could not create task for ${task.company}.`);
        }
      }

      for (const [index, company] of createdCompanies.entries()) {
        const result = await apiPost<LeadScore>("/api/leadscore", {
          companyId: company.id,
          signals: {
            industryMatch: Math.max(72, 96 - index * 5),
            employeeFit: Math.max(68, 92 - index * 6),
            openedEmailCount: 3 + index,
            clickedEmailCount: 2,
            proposalViews: index === 1 ? 2 : 1,
            estimatedBudget: Number(company.annual_revenue ?? 0) > 0 ? 42000 + index * 11000 : 64000,
            authorityLevel: Math.max(74, 92 - index * 6),
            daysUntilDecision: 14 + index * 11,
          },
        });
        if (!result.ok) {
          throw new Error(result.error ?? `Could not score ${company.name}.`);
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
      setStatus("Pipeline, tasks, lead scores, campaign, and audit events created.");
      await loadWorkspaceData();
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
      await loadWorkspaceData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create company.");
    } finally {
      setIsBusy(false);
    }
  }

  async function advanceDeal(deal: Deal) {
    setIsBusy(true);
    setError(null);
    try {
      const nextStage = nextDealStage(deal.stage);
      const result = await apiPatch<Deal>("/api/crm/deals", {
        id: deal.id,
        stage: nextStage,
        probability: Math.min(95, deal.probability + 12),
      });
      if (!result.ok) {
        throw new Error(result.error ?? "Could not update deal.");
      }
      setStatus(`${deal.name} advanced to ${nextStage}.`);
      await Promise.all([loadDeals(), loadAuditEvents()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update deal.");
    } finally {
      setIsBusy(false);
    }
  }

  async function completeTask(task: Task) {
    setIsBusy(true);
    setError(null);
    try {
      const result = await apiPatch<Task>("/api/crm/tasks", {
        id: task.id,
        status: task.status === "done" ? "open" : "done",
      });
      if (!result.ok) {
        throw new Error(result.error ?? "Could not update task.");
      }
      setStatus(task.status === "done" ? "Task reopened." : "Task completed.");
      await Promise.all([loadTasks(), loadAuditEvents()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update task.");
    } finally {
      setIsBusy(false);
    }
  }

  async function runMeetingPrep() {
    const company = companies[0];
    if (!company) {
      setError("Create or seed a company before running meeting prep.");
      return;
    }
    setIsBusy(true);
    setError(null);
    setAiOutput("Meeting prep is running...");
    try {
      const result = await apiPost<{ meetingPrep: string }>("/api/ai/meeting-prep", {
        companyId: company.id,
        meetingGoal: "Prepare an executive meeting to position iTechSmart as the IT accountability layer standard.",
      });
      if (!result.ok) {
        throw new Error(result.error ?? "Meeting prep failed.");
      }
      setAiOutput(result.data?.meetingPrep ?? "No meeting prep returned.");
      setStatus("AI meeting prep generated.");
      await loadAuditEvents();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Meeting prep failed.";
      setAiOutput(message);
      setError(message);
    } finally {
      setIsBusy(false);
    }
  }

  async function runProposalBuilder() {
    const deal = deals[0];
    if (!deal) {
      setError("Create or seed a deal before running proposal generation.");
      return;
    }
    setIsBusy(true);
    setError(null);
    setAiOutput("Proposal builder is running...");
    try {
      const result = await apiPost<{ proposal: string }>("/api/ai/proposal", {
        dealId: deal.id,
        offer: "RevenueOS, ProofLink audit receipts, managed IT accountability, executive reporting, and quarterly compliance review.",
        terms: "12-month managed service agreement with onboarding, monthly operating review, and ProofLink-backed accountability evidence.",
      });
      if (!result.ok) {
        throw new Error(result.error ?? "Proposal generation failed.");
      }
      setAiOutput(result.data?.proposal ?? "No proposal returned.");
      setStatus("AI proposal generated.");
      await loadAuditEvents();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Proposal generation failed.";
      setAiOutput(message);
      setError(message);
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

  async function loadDeals() {
    const result = await apiGet<Deal[]>("/api/crm/deals");
    if (result.ok) {
      setDeals(result.data ?? []);
    }
  }

  async function loadTasks() {
    const result = await apiGet<Task[]>("/api/crm/tasks");
    if (result.ok) {
      setTasks(result.data ?? []);
    }
  }

  async function loadLeadScores() {
    const result = await apiGet<LeadScore[]>("/api/leadscore");
    if (result.ok) {
      setLeadScores(result.data ?? []);
    }
  }

  async function loadAuditEvents() {
    const result = await apiGet<AuditEvent[]>("/api/audit/events");
    if (result.ok) {
      setAuditEvents(result.data ?? []);
    }
  }

  async function loadWorkspaceData() {
    await Promise.all([loadCompanies(), loadCampaigns(), loadDeals(), loadTasks(), loadLeadScores(), loadAuditEvents()]);
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
        <Metric label="Weighted Pipeline" value={formatCurrency(weightedPipeline)} detail={`${formatCurrency(totalPipeline)} account revenue signal`} />
        <Metric label="Open Tasks" value={openTaskCount.toString()} detail={`${campaigns.length} campaigns / ${leadScores.length} scores`} />
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
          <p>This sprint path also creates deals, urgent tasks, lead scores, and audit events.</p>
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

        <article className="workspace-panel">
          <div className="rev-panel-head">
            <div>
              <p className="rev-kicker">Pipeline</p>
              <h2>Deals</h2>
            </div>
            <span className="rev-pill">{deals.length} active</span>
          </div>
          <div className="workspace-stack">
            {deals.map((deal) => (
              <div className="workspace-row" key={deal.id}>
                <div>
                  <b>{deal.name}</b>
                  <span>{deal.company_name ?? "Company"} / {deal.stage}</span>
                </div>
                <em>{formatCurrency(Number(deal.amount))} / {deal.probability}%</em>
                <button type="button" onClick={() => void advanceDeal(deal)} disabled={isBusy}>
                  Advance
                </button>
              </div>
            ))}
            {deals.length === 0 ? <p>No deals yet.</p> : null}
          </div>
        </article>

        <article className="workspace-panel">
          <div className="rev-panel-head">
            <div>
              <p className="rev-kicker">Priorities</p>
              <h2>Tasks</h2>
            </div>
            <span className="rev-pill warning">{openTaskCount} open</span>
          </div>
          <div className="workspace-stack">
            {tasks.slice(0, 6).map((task) => (
              <div className="workspace-row" key={task.id}>
                <div>
                  <b>{task.title}</b>
                  <span>{task.status} / {task.priority}</span>
                </div>
                <em>{task.due_at ? new Date(task.due_at).toLocaleDateString() : "No due date"}</em>
                <button type="button" onClick={() => void completeTask(task)} disabled={isBusy}>
                  {task.status === "done" ? "Reopen" : "Done"}
                </button>
              </div>
            ))}
            {tasks.length === 0 ? <p>No tasks yet.</p> : null}
          </div>
        </article>

        <article className="workspace-panel workspace-wide">
          <div className="rev-panel-head">
            <div>
              <p className="rev-kicker">AI Workbench</p>
              <h2>Meeting Prep and Proposal Builder</h2>
            </div>
            <span className="rev-pill success">Audit logged</span>
          </div>
          <div className="workspace-ai-actions">
            <button type="button" onClick={() => void runMeetingPrep()} disabled={isBusy || !ownerReady}>
              Prepare Meeting
            </button>
            <button type="button" onClick={() => void runProposalBuilder()} disabled={isBusy || !ownerReady}>
              Generate Proposal
            </button>
          </div>
          <pre className="workspace-ai-output">{aiOutput}</pre>
        </article>

        <article className="workspace-panel workspace-wide">
          <div className="rev-panel-head">
            <div>
              <p className="rev-kicker">Lead Intelligence</p>
              <h2>Lead Scores</h2>
            </div>
            <span className="rev-pill success">{leadScores.length} scored</span>
          </div>
          <div className="rev-table-wrap">
            <table className="rev-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Fit</th>
                  <th>Intent</th>
                  <th>Behavior</th>
                  <th>Budget</th>
                  <th>Authority</th>
                  <th>Urgency</th>
                  <th>Overall</th>
                </tr>
              </thead>
              <tbody>
                {leadScores.map((score) => (
                  <tr key={score.id}>
                    <td>{score.company_name}</td>
                    <td>{score.fit_score}</td>
                    <td>{score.intent_score}</td>
                    <td>{score.behavior_score}</td>
                    <td>{score.budget_score}</td>
                    <td>{score.authority_score}</td>
                    <td>{score.urgency_score}</td>
                    <td><span className="rev-score">{score.overall_score}</span></td>
                  </tr>
                ))}
                {leadScores.length === 0 ? (
                  <tr>
                    <td colSpan={8}>No lead scores yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="workspace-panel workspace-wide">
          <div className="rev-panel-head">
            <div>
              <p className="rev-kicker">Article 12 Accountability</p>
              <h2>Audit Events</h2>
            </div>
            <span className="rev-pill">{auditEvents.length} events</span>
          </div>
          <div className="workspace-audit">
            {auditEvents.slice(0, 12).map((event) => (
              <div className="workspace-audit-row" key={event.id}>
                <time>{new Date(event.created_at).toLocaleString()}</time>
                <b>{event.action}</b>
                <span>{event.resource_type}</span>
                <em>{event.purpose} / {event.outcome}</em>
              </div>
            ))}
            {auditEvents.length === 0 ? <p>No audit events yet.</p> : null}
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

async function apiPatch<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  const response = await fetch(path, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}

function nextDealStage(stage: string) {
  const stages = ["research", "meeting", "proposal", "security-review", "negotiation", "closed-won"];
  const current = stages.indexOf(stage);
  if (current === -1) {
    return "meeting";
  }
  return stages[Math.min(stages.length - 1, current + 1)];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

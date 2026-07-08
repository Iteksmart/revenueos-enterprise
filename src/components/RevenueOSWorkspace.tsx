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

type Contact = {
  id: string;
  company_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  authority_level: number;
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
  step_count?: number;
  outbox_count?: number;
  queued_count?: number;
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

type CampaignExecution = {
  campaignId: string;
  status: string;
  steps: Array<{
    id: string;
    step_order: number;
    trigger_type: string;
    action_type: string;
    channel: string;
    delay_days: number;
    status: string;
    scheduled_at: string;
  }>;
  outbox: Array<{
    id: string;
    channel: string;
    recipient: string;
    subject: string;
    status: string;
    scheduled_at: string;
  }>;
};

type OutboxItem = {
  id: string;
  campaign_id: string | null;
  campaign_name: string | null;
  step_id: string | null;
  step_order: number | null;
  action_type: string | null;
  channel: string;
  recipient: string;
  subject: string;
  status: string;
  scheduled_at: string;
  sent_at: string | null;
  error: string | null;
  created_at: string;
};

type OutboxProcessResult = {
  claimed: number;
  processed: Array<{
    id: string;
    channel: string;
    recipient: string;
    subject: string;
    status: string;
    scheduled_at: string;
    sent_at: string | null;
    error: string | null;
  }>;
};

type CustomerSuccessSummary = {
  account_count: number;
  mrr: string;
  arr: string;
  avg_renewal_risk: number;
  at_risk_count: number;
  renewals_90_days: number;
};

type CustomerSuccessAccount = {
  id: string;
  company_id: string;
  company_name: string;
  industry: string | null;
  crm_health_score: number;
  mrr: string;
  arr: string;
  health_status: string;
  onboarding_status: string;
  renewal_date: string | null;
  renewal_risk: number;
  executive_sponsor: string | null;
  success_plan: string;
  last_touch_at: string | null;
  next_review_at: string | null;
  touchpoint_count: number;
  open_tickets: number;
  open_projects: number;
  open_documents: number;
  open_renewals: number;
};

type CustomerSuccessData = {
  summary: CustomerSuccessSummary;
  accounts: CustomerSuccessAccount[];
};

type ProposalArtifact = {
  id: string;
  deal_id: string;
  quote_id: string | null;
  title: string;
  status: string;
  version: number;
  proposal_body: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  deal_name: string;
  company_name: string;
  quote_number: string | null;
  subtotal: string | null;
  tax: string | null;
  total: string | null;
};

type AutomationRule = {
  id: string;
  name: string;
  status: string;
  trigger_event: string;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  action_type: string;
  action_config: Record<string, unknown>;
  run_count: number;
  recent_run_count: number;
  last_run_at: string | null;
  created_at: string;
};

type AutomationRun = {
  id: string;
  rule_id: string;
  event_type: string;
  outcome: string;
  resource_type: string | null;
  resource_id: string | null;
  created_at: string;
};

type AutomationData = {
  rules: AutomationRule[];
  runs: AutomationRun[];
};

type IntegrationConnection = {
  id: string;
  provider: string;
  category: string;
  status: string;
  auth_type: string;
  scopes: string[];
  health_status: string;
  last_checked_at: string | null;
  last_error: string | null;
  config: Record<string, unknown>;
  event_count: number;
  updated_at: string;
};

type IntegrationEvent = {
  id: string;
  connection_id: string;
  provider: string;
  event_type: string;
  outcome: string;
  summary: string;
  created_at: string;
};

type IntegrationData = {
  connections: IntegrationConnection[];
  events: IntegrationEvent[];
};

type IntegrationSyncResult = {
  provider: string;
  sourceCount: number;
  importedContacts: number;
  importedCompanies: number;
  skipped: number;
  errors: string[];
};

type SecurityUser = {
  id: string;
  external_subject: string;
  email: string;
  display_name: string;
  mfa_enrolled: boolean;
  created_at: string;
  roles: string[];
  permissions: string[];
};

type SecurityRole = {
  id: string;
  name: string;
  permissions: string[];
  created_at: string;
};

type SecurityData = {
  summary: {
    user_count: number;
    mfa_enrolled_count: number;
  };
  users: SecurityUser[];
  roles: SecurityRole[];
  roleCatalog: Array<{ name: string; permissions: string[] }>;
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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leadScores, setLeadScores] = useState<LeadScore[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
  const [customerSuccess, setCustomerSuccess] = useState<CustomerSuccessData | null>(null);
  const [proposals, setProposals] = useState<ProposalArtifact[]>([]);
  const [automations, setAutomations] = useState<AutomationData | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationData | null>(null);
  const [security, setSecurity] = useState<SecurityData | null>(null);
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
  const queuedOutboxCount = outboxItems.filter((item) => item.status === "queued").length;
  const sentOutboxCount = outboxItems.filter((item) => item.status === "sent").length;
  const customerSuccessSummary = customerSuccess?.summary;
  const customerSuccessAccounts = customerSuccess?.accounts ?? [];
  const openProposalValue = proposals
    .filter((proposal) => !["accepted", "expired", "withdrawn"].includes(proposal.status))
    .reduce((sum, proposal) => sum + Number(proposal.total ?? 0), 0);
  const automationRules = automations?.rules ?? [];
  const automationRuns = automations?.runs ?? [];
  const integrationConnections = integrations?.connections ?? [];
  const integrationEvents = integrations?.events ?? [];
  const readyIntegrationCount = integrationConnections.filter((connection) => connection.status === "connected" && connection.health_status === "healthy").length;
  const securityUsers = security?.users ?? [];
  const securityRoles = security?.roles ?? [];
  const mfaCoverage = security?.summary.user_count ? Math.round(((security.summary.mfa_enrolled_count ?? 0) / security.summary.user_count) * 100) : 0;

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
      const successAccounts = await apiPost<{ accountCount: number }>("/api/customer-success", { seed: true });
      if (!successAccounts.ok) {
        throw new Error(successAccounts.error ?? "Could not seed customer success accounts.");
      }
      const automationSeed = await apiPost<{ ruleCount: number }>("/api/automations", { seed: true });
      if (!automationSeed.ok) {
        throw new Error(automationSeed.error ?? "Could not seed automations.");
      }
      const integrationSeed = await apiPost<{ providerCount: number }>("/api/integrations", { seed: true });
      if (!integrationSeed.ok) {
        throw new Error(integrationSeed.error ?? "Could not seed integrations.");
      }
      const securitySeed = await apiPost<{ roleCount: number }>("/api/admin/security", { seed: true });
      if (!securitySeed.ok) {
        throw new Error(securitySeed.error ?? "Could not seed security roles.");
      }
      setStatus("Pipeline, tasks, lead scores, campaign, customer success accounts, automations, integrations, security roles, and audit events created.");
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
      setStatus("AI proposal generated and stored as a proposal artifact.");
      await Promise.all([loadProposals(), loadAuditEvents()]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Proposal generation failed.";
      setAiOutput(message);
      setError(message);
    } finally {
      setIsBusy(false);
    }
  }

  async function executeCampaign() {
    const campaign = campaigns[0];
    if (!campaign) {
      setError("Create or seed a campaign before execution.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const result = await apiPost<CampaignExecution>("/api/campaigns/execute", {
        campaignId: campaign.id,
        recipients: [user?.primaryEmailAddress?.emailAddress ?? "kevin@itechsmart.dev"],
      });
      if (!result.ok) {
        throw new Error(result.error ?? "Campaign execution failed.");
      }
      setStatus(`Campaign queued: ${result.data?.steps.length ?? 0} steps and ${result.data?.outbox.length ?? 0} outbox items.`);
      await Promise.all([loadCampaigns(), loadOutbox(), loadAuditEvents()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Campaign execution failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function processOutboxDryRun() {
    setIsBusy(true);
    setError(null);
    try {
      const result = await apiPost<OutboxProcessResult>("/api/campaigns/outbox", { limit: 10 });
      if (!result.ok) {
        throw new Error(result.error ?? "Outbox dry-run failed.");
      }
      setStatus(`Outbox dry-run processed ${result.data?.processed.length ?? 0} items.`);
      await Promise.all([loadCampaigns(), loadOutbox(), loadAuditEvents()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Outbox dry-run failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function seedCustomerSuccess() {
    setIsBusy(true);
    setError(null);
    try {
      const result = await apiPost<{ accountCount: number }>("/api/customer-success", { seed: true });
      if (!result.ok) {
        throw new Error(result.error ?? "Customer success seed failed.");
      }
      setStatus(`Customer Success seeded for ${result.data?.accountCount ?? 0} accounts.`);
      await Promise.all([loadCustomerSuccess(), loadAuditEvents()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Customer success seed failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function updateProposalStatus(proposal: ProposalArtifact, status: "sent" | "viewed" | "accepted") {
    setIsBusy(true);
    setError(null);
    try {
      const result = await apiPatch<ProposalArtifact>("/api/proposals", { id: proposal.id, status });
      if (!result.ok) {
        throw new Error(result.error ?? "Could not update proposal.");
      }
      setStatus(`${proposal.title} marked ${status}.`);
      await Promise.all([loadProposals(), loadAuditEvents()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update proposal.");
    } finally {
      setIsBusy(false);
    }
  }

  async function seedAutomations() {
    setIsBusy(true);
    setError(null);
    try {
      const result = await apiPost<{ ruleCount: number }>("/api/automations", { seed: true });
      if (!result.ok) {
        throw new Error(result.error ?? "Automation seed failed.");
      }
      setStatus(`Automation engine seeded with ${result.data?.ruleCount ?? 0} rules.`);
      await Promise.all([loadAutomations(), loadAuditEvents()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Automation seed failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function runSampleAutomation() {
    setIsBusy(true);
    setError(null);
    try {
      const company = companies[0];
      const deal = deals[0];
      const campaign = campaigns[0];
      const result = await apiPost<{ matched: number; executed: Array<{ outcome: string }> }>("/api/automations", {
        eventType: "email_clicked",
        companyId: company?.id ?? null,
        dealId: deal?.id ?? null,
        campaignId: campaign?.id ?? null,
        recipient: user?.primaryEmailAddress?.emailAddress ?? "kevin@itechsmart.dev",
      });
      if (!result.ok) {
        throw new Error(result.error ?? "Automation run failed.");
      }
      setStatus(`Automation event executed: ${result.data?.matched ?? 0} matching rules.`);
      await Promise.all([loadAutomations(), loadTasks(), loadOutbox(), loadAuditEvents()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Automation run failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function seedIntegrations() {
    setIsBusy(true);
    setError(null);
    try {
      const result = await apiPost<{ providerCount: number }>("/api/integrations", { seed: true });
      if (!result.ok) {
        throw new Error(result.error ?? "Integration seed failed.");
      }
      setStatus(`Integration catalog seeded with ${result.data?.providerCount ?? 0} providers.`);
      await Promise.all([loadIntegrations(), loadAuditEvents()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Integration seed failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function markIntegration(connection: IntegrationConnection, status: "configured" | "connected" | "error") {
    setIsBusy(true);
    setError(null);
    try {
      const healthStatus = status === "connected" ? "healthy" : status === "error" ? "failed" : "unknown";
      const result = await apiPost<IntegrationConnection>("/api/integrations", {
        provider: connection.provider,
        status,
        healthStatus,
        lastError: status === "error" ? "Provider app, OAuth consent, or webhook validation still required." : null,
      });
      if (!result.ok) {
        throw new Error(result.error ?? "Integration update failed.");
      }
      setStatus(`${connection.provider} marked ${status}.`);
      await Promise.all([loadIntegrations(), loadAuditEvents()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Integration update failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function syncIntegration(connection: IntegrationConnection) {
    setIsBusy(true);
    setError(null);
    try {
      const result = await apiPost<IntegrationSyncResult>("/api/integrations/sync", {
        provider: connection.provider,
        limit: 50,
      });
      if (!result.ok) {
        throw new Error(result.error ?? "Integration sync failed.");
      }
      const data = result.data;
      setStatus(
        `${connection.provider} synced ${data?.importedContacts ?? 0} contacts and ${data?.importedCompanies ?? 0} companies.`,
      );
      await Promise.all([loadIntegrations(), loadCompanies(), loadAuditEvents()]);
      await loadContacts();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Integration sync failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function seedSecurityRoles() {
    setIsBusy(true);
    setError(null);
    try {
      const result = await apiPost<{ roleCount: number }>("/api/admin/security", { seed: true });
      if (!result.ok) {
        throw new Error(result.error ?? "Security role seed failed.");
      }
      setStatus(`Security role catalog seeded with ${result.data?.roleCount ?? 0} roles.`);
      await Promise.all([loadSecurity(), loadAuditEvents()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Security role seed failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function updateSecurityUser(userRecord: SecurityUser, payload: { mfaEnrolled?: boolean; roleName?: string }) {
    setIsBusy(true);
    setError(null);
    try {
      const result = await apiPost<SecurityUser>("/api/admin/security", {
        userId: userRecord.id,
        ...payload,
      });
      if (!result.ok) {
        throw new Error(result.error ?? "Security update failed.");
      }
      setStatus(`${userRecord.email} security profile updated.`);
      await Promise.all([loadSecurity(), loadAuditEvents()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Security update failed.");
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

  async function loadContacts() {
    const result = await apiGet<Contact[]>("/api/crm/contacts");
    if (result.ok) {
      setContacts(result.data ?? []);
    } else {
      setError(result.error ?? "Could not load contacts.");
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

  async function loadOutbox() {
    const result = await apiGet<OutboxItem[]>("/api/campaigns/outbox");
    if (result.ok) {
      setOutboxItems(result.data ?? []);
    }
  }

  async function loadCustomerSuccess() {
    const result = await apiGet<CustomerSuccessData>("/api/customer-success");
    if (result.ok) {
      setCustomerSuccess(result.data ?? null);
    }
  }

  async function loadProposals() {
    const result = await apiGet<ProposalArtifact[]>("/api/proposals");
    if (result.ok) {
      setProposals(result.data ?? []);
    }
  }

  async function loadAutomations() {
    const result = await apiGet<AutomationData>("/api/automations");
    if (result.ok) {
      setAutomations(result.data ?? null);
    }
  }

  async function loadIntegrations() {
    const result = await apiGet<IntegrationData>("/api/integrations");
    if (result.ok) {
      setIntegrations(result.data ?? null);
    }
  }

  async function loadSecurity() {
    const result = await apiGet<SecurityData>("/api/admin/security");
    if (result.ok) {
      setSecurity(result.data ?? null);
    }
  }

  async function loadWorkspaceData() {
    await Promise.all([
      loadCompanies(),
      loadContacts(),
      loadCampaigns(),
      loadDeals(),
      loadTasks(),
      loadLeadScores(),
      loadOutbox(),
      loadCustomerSuccess(),
      loadProposals(),
      loadAutomations(),
      loadIntegrations(),
      loadSecurity(),
      loadAuditEvents(),
    ]);
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
        <Metric label="Companies" value={companies.length.toString()} detail={`${contacts.length} imported contacts`} />
        <Metric label="Weighted Pipeline" value={formatCurrency(weightedPipeline)} detail={`${formatCurrency(totalPipeline)} account revenue signal`} />
        <Metric label="Open Tasks" value={openTaskCount.toString()} detail={`${campaigns.length} campaigns / ${leadScores.length} scores`} />
        <Metric label="Outbox" value={queuedOutboxCount.toString()} detail={`${sentOutboxCount} dry-run sent`} />
        <Metric label="Customer ARR" value={formatCurrency(Number(customerSuccessSummary?.arr ?? 0))} detail={`${customerSuccessSummary?.renewals_90_days ?? 0} renewals in 90 days`} />
        <Metric label="Proposals" value={formatCurrency(openProposalValue)} detail={`${proposals.length} stored proposal artifacts`} />
        <Metric label="Automations" value={automationRules.length.toString()} detail={`${automationRuns.length} recent execution runs`} />
        <Metric label="Integrations" value={`${readyIntegrationCount}/${integrationConnections.length}`} detail={`${integrationEvents.length} recent provider events`} />
        <Metric label="MFA Coverage" value={`${mfaCoverage}%`} detail={`${securityRoles.length} RBAC roles / ${securityUsers.length} users`} />
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
              <p className="rev-kicker">Campaign Execution</p>
              <h2>Queued Nurture Engine</h2>
            </div>
            <span className="rev-pill warning">{campaigns.reduce((sum, campaign) => sum + (campaign.queued_count ?? 0), 0)} queued</span>
          </div>
          <div className="workspace-campaign-grid">
            <div className="workspace-stack">
              {campaigns.map((campaign) => (
                <div className="workspace-row" key={campaign.id}>
                  <div>
                    <b>{campaign.name}</b>
                    <span>{campaign.segment}</span>
                  </div>
                  <em>{campaign.status} / {campaign.step_count ?? 0} steps / {campaign.outbox_count ?? 0} outbox</em>
                </div>
              ))}
              {campaigns.length === 0 ? <p>No campaigns yet.</p> : null}
            </div>
            <div className="workspace-execution-panel">
              <p>Queue the default RevenueOS nurture sequence: value email, follow-up, and sales task trigger. Each item is auditable before any external provider sends it.</p>
              <button type="button" onClick={() => void executeCampaign()} disabled={isBusy || !ownerReady || campaigns.length === 0}>
                Queue Campaign
              </button>
              <button type="button" onClick={() => void processOutboxDryRun()} disabled={isBusy || !ownerReady || queuedOutboxCount === 0}>
                Process Dry Run
              </button>
            </div>
          </div>
        </article>

        <article className="workspace-panel workspace-wide">
          <div className="rev-panel-head">
            <div>
              <p className="rev-kicker">Notification Outbox</p>
              <h2>Queued and Dry-Run Delivery</h2>
            </div>
            <span className="rev-pill">{queuedOutboxCount} queued</span>
          </div>
          <div className="rev-table-wrap">
            <table className="rev-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Step</th>
                  <th>Channel</th>
                  <th>Recipient</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Scheduled</th>
                </tr>
              </thead>
              <tbody>
                {outboxItems.slice(0, 12).map((item) => (
                  <tr key={item.id}>
                    <td>{item.campaign_name ?? "-"}</td>
                    <td>{item.step_order ?? "-"} {item.action_type ?? ""}</td>
                    <td>{item.channel}</td>
                    <td>{item.recipient}</td>
                    <td>{item.subject}</td>
                    <td><span className="rev-score">{item.status}</span></td>
                    <td>{new Date(item.scheduled_at).toLocaleString()}</td>
                  </tr>
                ))}
                {outboxItems.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No outbox items yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="workspace-panel workspace-wide">
          <div className="rev-panel-head">
            <div>
              <p className="rev-kicker">Customer Success</p>
              <h2>Health, Renewals, and Portal Work</h2>
            </div>
            <span className={`rev-pill ${(customerSuccessSummary?.at_risk_count ?? 0) > 0 ? "warning" : "success"}`}>
              {customerSuccessSummary?.at_risk_count ?? 0} at risk
            </span>
          </div>
          <div className="workspace-cs-summary">
            <Metric label="Accounts" value={(customerSuccessSummary?.account_count ?? 0).toString()} detail="Customer success records" />
            <Metric label="MRR" value={formatCurrency(Number(customerSuccessSummary?.mrr ?? 0))} detail="Recurring monthly revenue" />
            <Metric label="ARR" value={formatCurrency(Number(customerSuccessSummary?.arr ?? 0))} detail="Annual recurring revenue" />
            <Metric label="Avg Risk" value={`${customerSuccessSummary?.avg_renewal_risk ?? 0}`} detail={`${customerSuccessSummary?.renewals_90_days ?? 0} renewals due soon`} />
          </div>
          <div className="workspace-execution-panel workspace-cs-action">
            <p>Create customer success accounts from the current CRM, including touchpoints, portal tickets, projects, documents, and renewal work.</p>
            <button type="button" onClick={() => void seedCustomerSuccess()} disabled={isBusy || !ownerReady || companies.length === 0}>
              Seed Customer Success
            </button>
          </div>
          <div className="rev-table-wrap">
            <table className="rev-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Health</th>
                  <th>ARR</th>
                  <th>Renewal</th>
                  <th>Risk</th>
                  <th>Portal</th>
                  <th>Last Touch</th>
                  <th>Next Review</th>
                </tr>
              </thead>
              <tbody>
                {customerSuccessAccounts.map((account) => (
                  <tr key={account.id}>
                    <td>{account.company_name}</td>
                    <td>{account.health_status} / {account.onboarding_status}</td>
                    <td>{formatCurrency(Number(account.arr))}</td>
                    <td>{account.renewal_date ? new Date(account.renewal_date).toLocaleDateString() : "-"}</td>
                    <td><span className="rev-score">{account.renewal_risk}</span></td>
                    <td>
                      {account.open_tickets} tickets / {account.open_projects} projects / {account.open_documents} docs / {account.open_renewals} renewals
                    </td>
                    <td>{account.last_touch_at ? new Date(account.last_touch_at).toLocaleDateString() : "-"}</td>
                    <td>{account.next_review_at ? new Date(account.next_review_at).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
                {customerSuccessAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={8}>No customer success accounts yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
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

        <article className="workspace-panel workspace-wide">
          <div className="rev-panel-head">
            <div>
              <p className="rev-kicker">Contacts</p>
              <h2>Imported Relationship Records</h2>
            </div>
            <span className="rev-pill success">{contacts.length} rows</span>
          </div>
          <div className="rev-table-wrap">
            <table className="rev-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Title</th>
                  <th>Authority</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {contacts.slice(0, 50).map((contact) => (
                  <tr key={contact.id}>
                    <td>{contact.first_name} {contact.last_name}</td>
                    <td>{contact.email ?? "-"}</td>
                    <td>{contact.phone ?? "-"}</td>
                    <td>{contact.title ?? "-"}</td>
                    <td><span className="rev-score">{contact.authority_level}</span></td>
                    <td>{new Date(contact.updated_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No contacts imported yet. Run Sync from Apollo or GoHighLevel.</td>
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
              <p className="rev-kicker">Proposal Builder</p>
              <h2>Stored Proposal Artifacts and Quotes</h2>
            </div>
            <span className="rev-pill success">{proposals.length} artifacts</span>
          </div>
          <div className="rev-table-wrap">
            <table className="rev-table">
              <thead>
                <tr>
                  <th>Proposal</th>
                  <th>Company</th>
                  <th>Quote</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Version</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((proposal) => (
                  <tr key={proposal.id}>
                    <td>{proposal.title}</td>
                    <td>{proposal.company_name}</td>
                    <td>{proposal.quote_number ?? "-"}</td>
                    <td>{formatCurrency(Number(proposal.total ?? 0))}</td>
                    <td><span className="rev-score">{proposal.status}</span></td>
                    <td>{proposal.expires_at ? new Date(proposal.expires_at).toLocaleDateString() : "-"}</td>
                    <td>v{proposal.version}</td>
                    <td>
                      <div className="workspace-table-actions">
                        <button type="button" onClick={() => void updateProposalStatus(proposal, "sent")} disabled={isBusy || proposal.status === "sent"}>
                          Sent
                        </button>
                        <button type="button" onClick={() => void updateProposalStatus(proposal, "viewed")} disabled={isBusy || proposal.status === "viewed"}>
                          Viewed
                        </button>
                        <button type="button" onClick={() => void updateProposalStatus(proposal, "accepted")} disabled={isBusy || proposal.status === "accepted"}>
                          Accepted
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {proposals.length === 0 ? (
                  <tr>
                    <td colSpan={8}>No proposal artifacts yet. Run Generate Proposal from the AI Workbench.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="workspace-panel workspace-wide">
          <div className="rev-panel-head">
            <div>
              <p className="rev-kicker">Automation Engine</p>
              <h2>IF/THEN Rules and Execution Runs</h2>
            </div>
            <span className="rev-pill success">{automationRules.length} rules</span>
          </div>
          <div className="workspace-execution-panel workspace-cs-action">
            <p>Seed the default RevenueOS rules, then run a sample clicked-email event. Matching rules create real CRM tasks or queued outbox items.</p>
            <button type="button" onClick={() => void seedAutomations()} disabled={isBusy || !ownerReady}>
              Seed Automations
            </button>
            <button type="button" onClick={() => void runSampleAutomation()} disabled={isBusy || !ownerReady || automationRules.length === 0}>
              Run Click Event
            </button>
          </div>
          <div className="workspace-campaign-grid">
            <div className="workspace-stack">
              {automationRules.map((rule) => (
                <div className="workspace-row" key={rule.id}>
                  <div>
                    <b>{rule.name}</b>
                    <span>IF {rule.condition_field} {rule.condition_operator} {rule.condition_value} THEN {rule.action_type}</span>
                  </div>
                  <em>{rule.run_count} total / {rule.recent_run_count} recent</em>
                </div>
              ))}
              {automationRules.length === 0 ? <p>No automation rules yet.</p> : null}
            </div>
            <div className="workspace-stack">
              {automationRuns.slice(0, 6).map((run) => (
                <div className="workspace-row" key={run.id}>
                  <div>
                    <b>{run.event_type}</b>
                    <span>{run.resource_type ?? "automation"} / {run.outcome}</span>
                  </div>
                  <em>{new Date(run.created_at).toLocaleString()}</em>
                </div>
              ))}
              {automationRuns.length === 0 ? <p>No automation runs yet.</p> : null}
            </div>
          </div>
        </article>

        <article className="workspace-panel workspace-wide">
          <div className="rev-panel-head">
            <div>
              <p className="rev-kicker">Integration Control Plane</p>
              <h2>Provider Readiness and OAuth Scope Ledger</h2>
            </div>
            <span className="rev-pill">{readyIntegrationCount} healthy</span>
          </div>
          <div className="workspace-execution-panel workspace-cs-action">
            <p>Seed the provider catalog, then track readiness for each external system. This records status and scope posture without exposing provider secrets to the browser.</p>
            <button type="button" onClick={() => void seedIntegrations()} disabled={isBusy || !ownerReady}>
              Seed Integrations
            </button>
          </div>
          <div className="rev-table-wrap">
            <table className="rev-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Category</th>
                  <th>Auth</th>
                  <th>Status</th>
                  <th>Health</th>
                  <th>Scopes</th>
                  <th>Last Check</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {integrationConnections.map((connection) => (
                  <tr key={connection.id}>
                    <td>{connection.provider}</td>
                    <td>{connection.category}</td>
                    <td>{connection.auth_type}</td>
                    <td><span className="rev-score">{connection.status}</span></td>
                    <td>{connection.health_status}</td>
                    <td>{connection.scopes.slice(0, 3).join(", ")}{connection.scopes.length > 3 ? "..." : ""}</td>
                    <td>
                      {connection.last_checked_at ? new Date(connection.last_checked_at).toLocaleString() : "-"}
                      {typeof connection.config?.importedContacts === "number" ? (
                        <small className="workspace-muted"> / {connection.config.importedContacts} contacts</small>
                      ) : null}
                    </td>
                    <td>
                      <div className="workspace-table-actions">
                        {["hubspot", "apollo", "notion", "gohighlevel"].includes(connection.provider) ? (
                          <button type="button" onClick={() => void syncIntegration(connection)} disabled={isBusy}>
                            Sync
                          </button>
                        ) : null}
                        <button type="button" onClick={() => void markIntegration(connection, "configured")} disabled={isBusy}>
                          Configured
                        </button>
                        <button type="button" onClick={() => void markIntegration(connection, "connected")} disabled={isBusy}>
                          Healthy
                        </button>
                        <button type="button" onClick={() => void markIntegration(connection, "error")} disabled={isBusy}>
                          Blocked
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {integrationConnections.length === 0 ? (
                  <tr>
                    <td colSpan={8}>No integration connections yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="workspace-panel workspace-wide">
          <div className="rev-panel-head">
            <div>
              <p className="rev-kicker">Admin and Security</p>
              <h2>RBAC, MFA, and Permission Ledger</h2>
            </div>
            <span className="rev-pill success">{securityRoles.length} roles</span>
          </div>
          <div className="workspace-execution-panel workspace-cs-action">
            <p>Seed operational roles, review user permissions, and track MFA enrollment status for the RevenueOS tenant.</p>
            <button type="button" onClick={() => void seedSecurityRoles()} disabled={isBusy || !ownerReady}>
              Seed Roles
            </button>
          </div>
          <div className="workspace-campaign-grid">
            <div className="rev-table-wrap">
              <table className="rev-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Roles</th>
                    <th>MFA</th>
                    <th>Permissions</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {securityUsers.map((securityUser) => (
                    <tr key={securityUser.id}>
                      <td>{securityUser.email}</td>
                      <td>{securityUser.roles.join(", ") || "-"}</td>
                      <td><span className="rev-score">{securityUser.mfa_enrolled ? "on" : "off"}</span></td>
                      <td>{securityUser.permissions.slice(0, 5).join(", ")}{securityUser.permissions.length > 5 ? "..." : ""}</td>
                      <td>
                        <div className="workspace-table-actions">
                          <button type="button" onClick={() => void updateSecurityUser(securityUser, { mfaEnrolled: !securityUser.mfa_enrolled })} disabled={isBusy}>
                            MFA
                          </button>
                          <button type="button" onClick={() => void updateSecurityUser(securityUser, { roleName: "Sales" })} disabled={isBusy}>
                            Sales
                          </button>
                          <button type="button" onClick={() => void updateSecurityUser(securityUser, { roleName: "Auditor" })} disabled={isBusy}>
                            Auditor
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {securityUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No RevenueOS users yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="workspace-stack">
              {securityRoles.map((role) => (
                <div className="workspace-row" key={role.id}>
                  <div>
                    <b>{role.name}</b>
                    <span>{role.permissions.join(", ")}</span>
                  </div>
                  <em>{role.permissions.length} permissions</em>
                </div>
              ))}
              {securityRoles.length === 0 ? <p>No roles yet.</p> : null}
            </div>
          </div>
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

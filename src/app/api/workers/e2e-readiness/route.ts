import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";
import { requireWorkerToken } from "@/lib/worker-auth";

type CheckResult = {
  name: string;
  ok: boolean;
  count?: number;
  detail?: string;
};

const requiredTables = [
  "revenueos_organizations",
  "revenueos_users",
  "revenueos_roles",
  "crm_companies",
  "crm_contacts",
  "crm_deals",
  "crm_tasks",
  "marketing_campaigns",
  "lead_scores",
  "audit_log_events",
  "campaign_steps",
  "notification_outbox",
  "customer_success_accounts",
  "customer_success_touchpoints",
  "customer_portal_items",
  "proposal_artifacts",
  "automation_rules",
  "automation_runs",
  "integration_connections",
  "integration_events",
];

export async function GET(request: Request) {
  try {
    requireWorkerToken(request);
    const [tables, organizations, recentAudit, outbox, automations, integrations] = await Promise.all([
      checkTables(),
      countTable("revenueos_organizations"),
      countTable("audit_log_events"),
      countTable("notification_outbox"),
      countTable("automation_rules"),
      countTable("integration_connections"),
    ]);

    const checks = [
      tables,
      organizations,
      recentAudit,
      outbox,
      automations,
      integrations,
    ];

    return jsonOk({
      ready: checks.every((check) => check.ok),
      checkedAt: new Date().toISOString(),
      checks,
    });
  } catch (error) {
    return jsonError(error);
  }
}

async function checkTables(): Promise<CheckResult> {
  const rows = await sql()`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name = any(${requiredTables})
  `;
  const found = new Set(rows.map((row) => String(row.table_name)));
  const missing = requiredTables.filter((table) => !found.has(table));
  return {
    name: "required_tables",
    ok: missing.length === 0,
    count: found.size,
    detail: missing.length ? `Missing: ${missing.join(", ")}` : "All required tables exist",
  };
}

async function countTable(tableName: string): Promise<CheckResult> {
  const rows = await sql().unsafe(`select count(*)::int as count from ${tableName}`);
  const count = Number(rows[0]?.count ?? 0);
  return {
    name: tableName,
    ok: true,
    count,
    detail: "Count query succeeded",
  };
}

import { sql } from "./db";
import { isSyncProvider, syncIntegrationContacts, type SyncProvider } from "./integration-sync";

const providerCatalog: Record<SyncProvider, { category: string; authType: string; scopes: string[] }> = {
  hubspot: { category: "crm", authType: "oauth", scopes: ["crm.objects.contacts.read", "crm.objects.deals.read"] },
  apollo: { category: "prospecting", authType: "api_key", scopes: ["contacts.read", "people.search"] },
  gohighlevel: { category: "crm", authType: "api_key", scopes: ["contacts.read", "opportunities.read"] },
  notion: { category: "knowledge", authType: "api_key", scopes: ["pages.read", "databases.read"] },
};

export async function runIntegrationSync(input: {
  organizationId?: string;
  provider?: string;
  providers?: string[];
  limit: number;
}) {
  const organizationId = input.organizationId ?? await findLatestOrganizationId();
  const providers = normalizeProviders(input.provider, input.providers);
  const results = [];

  for (const provider of providers) {
    const connectionId = await ensureConnection(organizationId, provider);
    try {
      const result = await syncIntegrationContacts({ organizationId, provider, limit: input.limit });
      const healthStatus = result.errors.length > 0 ? "degraded" : "healthy";
      await recordSyncResult(organizationId, connectionId, provider, healthStatus, result);
      results.push({ provider, ok: result.errors.length === 0, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown sync error";
      await recordSyncError(organizationId, connectionId, provider, message);
      results.push({ provider, ok: false, error: message });
    }
  }

  return { organizationId, results };
}

function normalizeProviders(provider?: string, providers?: string[]) {
  const requested = providers?.length ? providers : provider ? [provider] : ["apollo", "notion", "gohighlevel"];
  const normalized: SyncProvider[] = [];
  for (const item of requested) {
    if (!isSyncProvider(item)) {
      throw new Error(`Unsupported sync provider: ${item}`);
    }
    normalized.push(item);
  }
  return [...new Set(normalized)];
}

async function findLatestOrganizationId() {
  const rows = await sql()`
    select id from revenueos_organizations
    order by created_at desc
    limit 1
  `;
  const organizationId = rows[0]?.id;
  if (!organizationId) {
    throw new Error("No RevenueOS organization exists yet");
  }
  return String(organizationId);
}

async function ensureConnection(organizationId: string, provider: SyncProvider) {
  const catalog = providerCatalog[provider];
  const rows = await sql()`
    insert into integration_connections (
      organization_id, provider, category, auth_type, scopes, status, health_status, config
    ) values (
      ${organizationId}, ${provider}, ${catalog.category}, ${catalog.authType}, ${catalog.scopes},
      'configured', 'unknown', ${JSON.stringify({ required: true, workerManaged: true })}
    )
    on conflict (organization_id, provider) do update set
      category = excluded.category,
      auth_type = excluded.auth_type,
      scopes = excluded.scopes,
      updated_at = now()
    returning id
  `;
  return String(rows[0].id);
}

async function recordSyncResult(
  organizationId: string,
  connectionId: string,
  provider: SyncProvider,
  healthStatus: "healthy" | "degraded",
  result: unknown,
) {
  await sql().begin(async (transaction) => {
    await transaction`
      update integration_connections set
        status = 'connected',
        health_status = ${healthStatus},
        last_checked_at = now(),
        last_error = ${(result as { errors?: string[] }).errors?.[0] ?? null},
        config = config || ${JSON.stringify({
          lastWorkerSync: new Date().toISOString(),
          importedContacts: (result as { importedContacts?: number }).importedContacts ?? 0,
          importedCompanies: (result as { importedCompanies?: number }).importedCompanies ?? 0,
          skipped: (result as { skipped?: number }).skipped ?? 0,
        })}::jsonb,
        updated_at = now()
      where id = ${connectionId}
    `;
    await transaction`
      insert into integration_events (
        organization_id, connection_id, event_type, outcome, summary, metadata
      ) values (
        ${organizationId},
        ${connectionId},
        'contacts.worker_sync',
        ${healthStatus},
        ${`${provider} worker sync completed`},
        ${JSON.stringify(result)}
      )
    `;
  });
}

async function recordSyncError(organizationId: string, connectionId: string, provider: SyncProvider, message: string) {
  await sql().begin(async (transaction) => {
    await transaction`
      update integration_connections set
        status = 'error',
        health_status = 'failed',
        last_checked_at = now(),
        last_error = ${message},
        updated_at = now()
      where id = ${connectionId}
    `;
    await transaction`
      insert into integration_events (
        organization_id, connection_id, event_type, outcome, summary, metadata
      ) values (
        ${organizationId},
        ${connectionId},
        'contacts.worker_sync',
        'failed',
        ${`${provider} worker sync failed`},
        ${JSON.stringify({ error: message })}
      )
    `;
  });
}

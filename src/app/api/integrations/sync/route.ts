import { z } from "zod";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { sql } from "@/lib/db";
import { isSyncProvider, syncIntegrationContacts } from "@/lib/integration-sync";
import { jsonError, jsonOk } from "@/lib/responses";

const syncSchema = z.object({
  provider: z.string().trim(),
  limit: z.number().int().min(1).max(100).default(50),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, "crm:write");
    const organizationId = requireOrganization(auth.organizationId);
    const body = syncSchema.parse(await request.json());
    if (!isSyncProvider(body.provider)) {
      return NextResponse.json({ ok: false, error: `Provider ${body.provider} does not support contact sync yet.` }, { status: 400 });
    }

    const connectionRows = await sql()`
      select id from integration_connections
      where organization_id = ${organizationId} and provider = ${body.provider}
      limit 1
    `;
    const connectionId = connectionRows[0]?.id;
    if (!connectionId) {
      return NextResponse.json({ ok: false, error: "Connection not found. Seed integrations first." }, { status: 404 });
    }

    const result = await syncIntegrationContacts({
      organizationId,
      provider: body.provider,
      limit: body.limit,
    });

    const healthStatus = result.errors.length > 0 ? "degraded" : "healthy";
    await sql().begin(async (transaction) => {
      await transaction`
        update integration_connections set
          status = 'connected',
          health_status = ${healthStatus},
          last_checked_at = now(),
          last_error = ${result.errors[0] ?? null},
          config = config || ${JSON.stringify({
            lastSync: new Date().toISOString(),
            importedContacts: result.importedContacts,
            importedCompanies: result.importedCompanies,
            skipped: result.skipped,
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
          'contacts.sync',
          ${healthStatus},
          ${`${body.provider} sync imported ${result.importedContacts} contacts and touched ${result.importedCompanies} companies`},
          ${JSON.stringify(result)}
        )
      `;
    });

    await writeAuditEvent({
      auth,
      action: "integrations.contacts.sync",
      resourceType: "integration_connection",
      resourceId: String(connectionId),
      purpose: "crm-data-ingestion",
      outcome: result.errors.length > 0 ? "error" : "success",
      metadata: result,
    });

    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}

function requireOrganization(organizationId?: string) {
  if (!organizationId) {
    throw new Error("Authenticated token must include org_id");
  }
  return organizationId;
}

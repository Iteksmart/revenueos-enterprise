import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";

const seedSchema = z.object({ seed: z.literal(true) });

const updateConnectionSchema = z.object({
  provider: z.string().trim().min(2).max(80),
  status: z.enum(["not_configured", "configured", "connected", "paused", "error"]).optional(),
  healthStatus: z.enum(["unknown", "healthy", "degraded", "failed"]).optional(),
  lastError: z.string().trim().max(500).nullable().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const providerCatalog = [
  { provider: "microsoft-365", category: "productivity", authType: "oauth", scopes: ["User.Read", "Mail.Send", "Calendars.ReadWrite"] },
  { provider: "google-workspace", category: "productivity", authType: "oauth", scopes: ["openid", "email", "profile", "gmail.send", "calendar.events"] },
  { provider: "slack", category: "collaboration", authType: "oauth", scopes: ["chat:write", "channels:read"] },
  { provider: "zoom", category: "meetings", authType: "oauth", scopes: ["meeting:read", "recording:read"] },
  { provider: "hubspot", category: "crm", authType: "oauth", scopes: ["crm.objects.contacts.read", "crm.objects.deals.read"] },
  { provider: "salesforce", category: "crm", authType: "oauth", scopes: ["api", "refresh_token"] },
  { provider: "quickbooks", category: "finance", authType: "oauth", scopes: ["com.intuit.quickbooks.accounting"] },
  { provider: "stripe", category: "payments", authType: "api_key", scopes: ["customers", "invoices", "subscriptions"] },
  { provider: "twilio", category: "communications", authType: "api_key", scopes: ["messages", "calls"] },
  { provider: "sendgrid", category: "email", authType: "api_key", scopes: ["mail.send"] },
  { provider: "mailgun", category: "email", authType: "api_key", scopes: ["messages"] },
  { provider: "n8n", category: "automation", authType: "api_key", scopes: ["workflows"] },
  { provider: "zapier", category: "automation", authType: "oauth", scopes: ["hooks"] },
  { provider: "make", category: "automation", authType: "oauth", scopes: ["scenarios"] },
];

type IntegrationConnectionRow = {
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
  created_at: string;
  updated_at: string;
};

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, "crm:read");
    const organizationId = requireOrganization(auth.organizationId);
    const connections = await sql()`
      select
        c.id,
        c.provider,
        c.category,
        c.status,
        c.auth_type,
        c.scopes,
        c.health_status,
        c.last_checked_at,
        c.last_error,
        c.config,
        c.created_at,
        c.updated_at,
        coalesce(e.event_count, 0)::int as event_count
      from integration_connections c
      left join lateral (
        select count(*) as event_count
        from integration_events e
        where e.connection_id = c.id
      ) e on true
      where c.organization_id = ${organizationId}
      order by c.category asc, c.provider asc
    `;
    const events = await sql()`
      select e.id, e.connection_id, c.provider, e.event_type, e.outcome, e.summary, e.created_at
      from integration_events e
      join integration_connections c on c.id = e.connection_id
      where e.organization_id = ${organizationId}
      order by e.created_at desc
      limit 30
    `;
    await writeAuditEvent({
      auth,
      action: "integrations.list",
      resourceType: "integration_connection",
      purpose: "integration-management",
      outcome: "success",
    });
    return jsonOk({ connections, events });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, "crm:write");
    const organizationId = requireOrganization(auth.organizationId);
    const payload = await request.json();

    if (seedSchema.safeParse(payload).success) {
      for (const item of providerCatalog) {
        await sql()`
          insert into integration_connections (
            organization_id, provider, category, auth_type, scopes, status, health_status, config
          ) values (
            ${organizationId}, ${item.provider}, ${item.category}, ${item.authType}, ${item.scopes},
            'not_configured', 'unknown', ${JSON.stringify({ required: true })}
          )
          on conflict (organization_id, provider) do update set
            category = excluded.category,
            auth_type = excluded.auth_type,
            scopes = excluded.scopes,
            updated_at = now()
        `;
      }
      await writeAuditEvent({
        auth,
        action: "integrations.seed",
        resourceType: "integration_connection",
        purpose: "integration-management",
        outcome: "success",
        metadata: { providerCount: providerCatalog.length },
      });
      return jsonOk({ providerCount: providerCatalog.length }, 201);
    }

    const body = updateConnectionSchema.parse(payload);
    const rows = await sql().begin(async (transaction): Promise<IntegrationConnectionRow[]> => {
      const connections = await transaction`
        update integration_connections set
          status = coalesce(${body.status ?? null}, status),
          health_status = coalesce(${body.healthStatus ?? null}, health_status),
          last_error = case when ${body.lastError === undefined} then last_error else ${body.lastError ?? null} end,
          last_checked_at = now(),
          config = config || ${JSON.stringify(body.config ?? {})}::jsonb,
          updated_at = now()
        where organization_id = ${organizationId} and provider = ${body.provider}
        returning id, provider, category, status, auth_type, scopes, health_status, last_checked_at, last_error, config, created_at, updated_at
      `;
      const connection = connections[0];
      if (!connection) {
        return [];
      }
      await transaction`
        insert into integration_events (
          organization_id, connection_id, event_type, outcome, summary, metadata
        ) values (
          ${organizationId}, ${connection.id}, 'connection.status_update', ${connection.health_status},
          ${`${connection.provider} marked ${connection.status} / ${connection.health_status}`},
          ${JSON.stringify({ status: connection.status, healthStatus: connection.health_status })}
        )
      `;
      return connections as unknown as IntegrationConnectionRow[];
    });

    if (!rows[0]) {
      return jsonOk({ connection: null, reason: "Connection not found. Seed integrations first." }, 404);
    }

    await writeAuditEvent({
      auth,
      action: "integrations.update",
      resourceType: "integration_connection",
      resourceId: rows[0].id,
      purpose: "integration-management",
      outcome: "success",
      metadata: { provider: body.provider, status: body.status, healthStatus: body.healthStatus },
    });
    return jsonOk(rows[0]);
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

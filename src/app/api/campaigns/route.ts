import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";

const createCampaignSchema = z.object({
  name: z.string().min(2),
  segment: z.string().min(2),
  status: z.enum(["draft", "approved", "running", "paused", "completed"]).default("draft"),
  cadenceDays: z.number().int().min(1).max(90).default(14),
  consentPolicy: z.string().min(4).default("business-context-only"),
});

const updateCampaignSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["draft", "approved", "running", "paused", "completed"]).optional(),
  cadenceDays: z.number().int().min(1).max(90).optional(),
  consentPolicy: z.string().min(4).optional(),
});

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, "campaigns:read");
    const organizationId = requireOrganization(auth.organizationId);
    const rows = await sql()`
      select
        c.id,
        c.name,
        c.segment,
        c.status,
        c.cadence_days,
        c.consent_policy,
        c.created_at,
        count(distinct s.id)::int as step_count,
        count(distinct o.id)::int as outbox_count,
        count(distinct o.id) filter (where o.status = 'queued')::int as queued_count
      from marketing_campaigns c
      left join campaign_steps s on s.campaign_id = c.id
      left join notification_outbox o on o.campaign_id = c.id
      where c.organization_id = ${organizationId}
      group by c.id
      order by c.created_at desc
      limit 100
    `;
    await writeAuditEvent({ auth, action: "campaigns.list", resourceType: "marketing_campaign", purpose: "campaign-management", outcome: "success" });
    return jsonOk(rows);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, "campaigns:write");
    const organizationId = requireOrganization(auth.organizationId);
    const body = createCampaignSchema.parse(await request.json());
    const rows = await sql()`
      insert into marketing_campaigns (organization_id, name, segment, status, cadence_days, consent_policy)
      values (${organizationId}, ${body.name}, ${body.segment}, ${body.status}, ${body.cadenceDays}, ${body.consentPolicy})
      returning id, name, segment, status, cadence_days, consent_policy, created_at
    `;
    await writeAuditEvent({ auth, action: "campaigns.create", resourceType: "marketing_campaign", resourceId: rows[0]?.id, purpose: "campaign-management", outcome: "success" });
    return jsonOk(rows[0], 201);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth(request, "campaigns:write");
    const organizationId = requireOrganization(auth.organizationId);
    const body = updateCampaignSchema.parse(await request.json());
    const rows = await sql()`
      update marketing_campaigns set
        status = coalesce(${body.status ?? null}, status),
        cadence_days = coalesce(${body.cadenceDays ?? null}, cadence_days),
        consent_policy = coalesce(${body.consentPolicy ?? null}, consent_policy)
      where organization_id = ${organizationId} and id = ${body.id}
      returning id, name, segment, status, cadence_days, consent_policy, created_at
    `;
    if (!rows[0]) {
      return jsonOk({ campaign: null, reason: "Campaign not found" }, 404);
    }
    await writeAuditEvent({
      auth,
      action: "campaigns.update",
      resourceType: "marketing_campaign",
      resourceId: rows[0].id,
      purpose: "campaign-management",
      outcome: "success",
      metadata: { status: body.status },
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

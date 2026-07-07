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

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, "campaigns:read");
    const organizationId = requireOrganization(auth.organizationId);
    const rows = await sql()`
      select id, name, segment, status, cadence_days, consent_policy, created_at
      from marketing_campaigns
      where organization_id = ${organizationId}
      order by created_at desc
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

function requireOrganization(organizationId?: string) {
  if (!organizationId) {
    throw new Error("Authenticated token must include org_id");
  }
  return organizationId;
}

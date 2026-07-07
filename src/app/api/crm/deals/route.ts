import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";

const createDealSchema = z.object({
  companyId: z.string().uuid(),
  primaryContactId: z.string().uuid().nullable().optional(),
  name: z.string().min(2),
  stage: z.string().min(2),
  amount: z.number().nonnegative().default(0),
  probability: z.number().int().min(0).max(100).default(10),
  closeDate: z.string().date().nullable().optional(),
  source: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, "crm:read");
    const organizationId = requireOrganization(auth.organizationId);
    const rows = await sql()`
      select d.id, d.name, d.stage, d.amount, d.probability, d.close_date, d.source, d.created_at, c.name as company_name
      from crm_deals d
      join crm_companies c on c.id = d.company_id
      where d.organization_id = ${organizationId}
      order by d.updated_at desc
      limit 100
    `;
    await writeAuditEvent({ auth, action: "crm.deals.list", resourceType: "crm_deal", purpose: "pipeline-review", outcome: "success" });
    return jsonOk(rows);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, "crm:write");
    const organizationId = requireOrganization(auth.organizationId);
    const body = createDealSchema.parse(await request.json());
    const rows = await sql()`
      insert into crm_deals (
        organization_id, company_id, primary_contact_id, name, stage, amount, probability, close_date, source
      ) values (
        ${organizationId}, ${body.companyId}, ${body.primaryContactId ?? null}, ${body.name}, ${body.stage},
        ${body.amount}, ${body.probability}, ${body.closeDate ?? null}, ${body.source ?? null}
      )
      returning id, company_id, primary_contact_id, name, stage, amount, probability, close_date, source, created_at
    `;
    await writeAuditEvent({ auth, action: "crm.deals.create", resourceType: "crm_deal", resourceId: rows[0]?.id, purpose: "pipeline-management", outcome: "success" });
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

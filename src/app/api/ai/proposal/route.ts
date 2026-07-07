import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { runRevenueAgent } from "@/lib/ai";
import { writeAuditEvent } from "@/lib/audit";
import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";

const requestSchema = z.object({
  dealId: z.string().uuid(),
  offer: z.string().min(4),
  terms: z.string().min(4),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, "ai:execute");
    const organizationId = requireOrganization(auth.organizationId);
    const body = requestSchema.parse(await request.json());
    const deals = await sql()`
      select d.id, d.name, d.stage, d.amount, d.probability, d.close_date, c.name as company_name, c.industry
      from crm_deals d
      join crm_companies c on c.id = d.company_id
      where d.organization_id = ${organizationId} and d.id = ${body.dealId}
      limit 1
    `;
    if (!deals[0]) {
      return jsonOk({ proposal: null, reason: "Deal not found" }, 404);
    }

    const proposal = await runRevenueAgent([
      {
        role: "system",
        content: "You are RevenueOS proposal builder. Return an executive-ready proposal with summary, scope, deliverables, timeline, commercial terms, proof/audit posture, and next steps.",
      },
      {
        role: "user",
        content: JSON.stringify({ deal: deals[0], offer: body.offer, terms: body.terms }),
      },
    ]);

    await writeAuditEvent({
      auth,
      action: "ai.proposal.generate",
      resourceType: "crm_deal",
      resourceId: body.dealId,
      purpose: "proposal-generation",
      outcome: "success",
    });
    return jsonOk({ proposal });
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

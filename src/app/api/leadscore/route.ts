import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { sql } from "@/lib/db";
import { calculateLeadScore, leadScoreInputSchema } from "@/lib/leadscore";
import { jsonError, jsonOk } from "@/lib/responses";

const requestSchema = z.object({
  companyId: z.string().uuid(),
  signals: leadScoreInputSchema,
});

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, "leadscore:read");
    const organizationId = requireOrganization(auth.organizationId);
    const rows = await sql()`
      select
        ls.id,
        ls.company_id,
        c.name as company_name,
        ls.fit_score,
        ls.intent_score,
        ls.behavior_score,
        ls.budget_score,
        ls.authority_score,
        ls.urgency_score,
        ls.overall_score,
        ls.explanation,
        ls.created_at
      from lead_scores ls
      join crm_companies c on c.id = ls.company_id
      where ls.organization_id = ${organizationId}
      order by ls.created_at desc
      limit 100
    `;
    await writeAuditEvent({
      auth,
      action: "leadscore.list",
      resourceType: "lead_score",
      purpose: "lead-prioritization",
      outcome: "success",
      userAgent: request.headers.get("user-agent"),
    });
    return jsonOk(rows);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, "leadscore:write");
    const organizationId = requireOrganization(auth.organizationId);
    const body = requestSchema.parse(await request.json());
    const score = calculateLeadScore(body.signals);
    const rows = await sql()`
      insert into lead_scores (
        organization_id, company_id, fit_score, intent_score, behavior_score, budget_score,
        authority_score, urgency_score, overall_score, explanation
      ) values (
        ${organizationId}, ${body.companyId}, ${score.fitScore}, ${score.intentScore}, ${score.behaviorScore},
        ${score.budgetScore}, ${score.authorityScore}, ${score.urgencyScore}, ${score.overallScore}, ${score.explanation}
      )
      returning *
    `;
    await writeAuditEvent({
      auth,
      action: "leadscore.calculate",
      resourceType: "lead_score",
      resourceId: rows[0]?.id,
      purpose: "lead-prioritization",
      outcome: "success",
      metadata: { companyId: body.companyId, overallScore: score.overallScore },
    });
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

import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { runRevenueAgent } from "@/lib/ai";
import { writeAuditEvent } from "@/lib/audit";
import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";

const requestSchema = z.object({
  companyId: z.string().uuid(),
  meetingGoal: z.string().min(4),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, "ai:execute");
    const organizationId = requireOrganization(auth.organizationId);
    const body = requestSchema.parse(await request.json());
    const companies = await sql()`
      select id, name, domain, industry, employee_count, annual_revenue, lifecycle_stage, health_score
      from crm_companies
      where organization_id = ${organizationId} and id = ${body.companyId}
      limit 1
    `;
    if (!companies[0]) {
      return jsonOk({ meetingPrep: null, reason: "Company not found" }, 404);
    }

    const output = await runRevenueAgent([
      {
        role: "system",
        content: "You are RevenueOS meeting prep. Return concise sections: company summary, pain points, questions, competitors, recommended products, estimated budget, follow-up risks.",
      },
      {
        role: "user",
        content: JSON.stringify({ company: companies[0], meetingGoal: body.meetingGoal }),
      },
    ]);

    await writeAuditEvent({
      auth,
      action: "ai.meeting_prep.generate",
      resourceType: "crm_company",
      resourceId: body.companyId,
      purpose: "meeting-preparation",
      outcome: "success",
    });
    return jsonOk({ meetingPrep: output });
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

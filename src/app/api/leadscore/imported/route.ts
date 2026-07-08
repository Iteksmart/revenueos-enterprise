import { requireAuth } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { sql } from "@/lib/db";
import { calculateLeadScore } from "@/lib/leadscore";
import { jsonError, jsonOk } from "@/lib/responses";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, "leadscore:write");
    const organizationId = requireOrganization(auth.organizationId);
    const companies = await sql()`
      select
        c.id,
        c.name,
        c.industry,
        c.employee_count,
        c.annual_revenue,
        c.health_score,
        count(distinct ct.id)::int as contact_count,
        coalesce(array_agg(distinct er.provider) filter (where er.provider is not null), '{}') as providers
      from crm_companies c
      left join crm_contacts ct on ct.company_id = c.id
      left join integration_external_records er on er.crm_company_id = c.id or er.crm_contact_id = ct.id
      where c.organization_id = ${organizationId}
        and (c.lifecycle_stage = 'imported' or er.id is not null)
        and not exists (
          select 1 from lead_scores existing
          where existing.organization_id = c.organization_id
            and existing.company_id = c.id
        )
      group by c.id
      order by c.updated_at desc
      limit 100
    `;

    const scored = [];
    for (const company of companies) {
      const providerBoost = Array.isArray(company.providers) && company.providers.includes("apollo") ? 8 : 0;
      const contactCount = Number(company.contact_count ?? 0);
      const annualRevenue = Number(company.annual_revenue ?? 0);
      const score = calculateLeadScore({
        industryMatch: Math.min(95, 58 + providerBoost + Math.min(contactCount * 4, 20)),
        employeeFit: company.employee_count ? Math.min(96, 50 + Number(company.employee_count) / 12) : 64,
        openedEmailCount: 0,
        clickedEmailCount: 0,
        proposalViews: 0,
        estimatedBudget: annualRevenue > 0 ? Math.max(12000, annualRevenue * 0.015) : 18000 + contactCount * 3000,
        authorityLevel: Math.min(88, 52 + contactCount * 7),
        daysUntilDecision: contactCount >= 2 ? 30 : 60,
      });
      const rows = await sql()`
        insert into lead_scores (
          organization_id, company_id, fit_score, intent_score, behavior_score, budget_score,
          authority_score, urgency_score, overall_score, explanation
        ) values (
          ${organizationId}, ${company.id}, ${score.fitScore}, ${score.intentScore}, ${score.behaviorScore},
          ${score.budgetScore}, ${score.authorityScore}, ${score.urgencyScore}, ${score.overallScore}, ${score.explanation}
        )
        returning id, company_id, overall_score
      `;
      scored.push(rows[0]);
    }

    await writeAuditEvent({
      auth,
      action: "leadscore.imported.bulk_calculate",
      resourceType: "lead_score",
      purpose: "lead-prioritization",
      outcome: "success",
      metadata: { scoredCount: scored.length },
    });

    return jsonOk({ scoredCount: scored.length, scored });
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

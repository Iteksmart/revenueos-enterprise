import { requireAuth } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";

const SALES_PLAY_SOURCE = "revenueos-imported-sales-play";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, "crm:write");
    const organizationId = requireOrganization(auth.organizationId);
    const candidates = await sql()`
      select distinct on (c.id)
        c.id,
        c.name,
        c.domain,
        ls.overall_score,
        ls.fit_score,
        ls.authority_score,
        ls.budget_score,
        ct.id as primary_contact_id,
        ct.first_name,
        ct.last_name
      from crm_companies c
      join lead_scores ls on ls.company_id = c.id and ls.organization_id = c.organization_id
      left join crm_contacts ct on ct.company_id = c.id
      where c.organization_id = ${organizationId}
        and (c.lifecycle_stage = 'imported' or exists (
          select 1 from integration_external_records er
          where er.crm_company_id = c.id
        ))
        and not exists (
          select 1 from crm_deals d
          where d.organization_id = c.organization_id
            and d.company_id = c.id
            and d.source = ${SALES_PLAY_SOURCE}
        )
      order by c.id, ls.overall_score desc, ct.updated_at desc nulls last
      limit 12
    `;

    const created = [];
    for (const candidate of candidates) {
      const amount = Math.max(12000, Number(candidate.budget_score ?? 50) * 650);
      const probability = Math.max(25, Math.min(80, Number(candidate.overall_score ?? 40) + 15));
      const closeDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString().slice(0, 10);
      const dealRows = await sql()`
        insert into crm_deals (
          organization_id, company_id, primary_contact_id, name, stage, amount, probability, close_date, source
        ) values (
          ${organizationId},
          ${candidate.id},
          ${candidate.primary_contact_id ?? null},
          ${`${candidate.name} Imported Opportunity`},
          'research',
          ${amount},
          ${probability},
          ${closeDate},
          ${SALES_PLAY_SOURCE}
        )
        returning id, name, amount, probability
      `;
      const taskTitle = candidate.primary_contact_id
        ? `Call ${candidate.first_name} ${candidate.last_name} at ${candidate.name}`
        : `Research and call ${candidate.name}`;
      const taskRows = await sql()`
        insert into crm_tasks (
          organization_id, company_id, deal_id, title, status, priority, due_at
        ) values (
          ${organizationId},
          ${candidate.id},
          ${dealRows[0].id},
          ${taskTitle},
          'open',
          ${Number(candidate.overall_score ?? 0) >= 50 ? "urgent" : "high"},
          ${new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()}
        )
        returning id, title, priority
      `;
      created.push({
        companyId: candidate.id,
        companyName: candidate.name,
        overallScore: candidate.overall_score,
        deal: dealRows[0],
        task: taskRows[0],
      });
    }

    await writeAuditEvent({
      auth,
      action: "salesplays.imported.create",
      resourceType: "crm_deal",
      purpose: "pipeline-generation",
      outcome: "success",
      metadata: { createdCount: created.length },
    });

    return jsonOk({ createdCount: created.length, created });
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

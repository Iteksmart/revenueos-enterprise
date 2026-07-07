import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";

const createCompanySchema = z.object({
  name: z.string().min(2),
  domain: z.string().min(3).nullable().optional(),
  industry: z.string().nullable().optional(),
  employeeCount: z.number().int().positive().nullable().optional(),
  annualRevenue: z.number().nonnegative().nullable().optional(),
  lifecycleStage: z.string().min(2).default("prospect"),
  healthScore: z.number().int().min(0).max(100).default(50),
});

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, "crm:read");
    const organizationId = requireOrganization(auth.organizationId);
    const rows = await sql()`
      select id, name, domain, industry, employee_count, annual_revenue, lifecycle_stage, health_score, created_at, updated_at
      from crm_companies
      where organization_id = ${organizationId}
      order by updated_at desc
      limit 100
    `;
    await writeAuditEvent({
      auth,
      action: "crm.companies.list",
      resourceType: "crm_company",
      purpose: "sales-operations",
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
    const auth = await requireAuth(request, "crm:write");
    const organizationId = requireOrganization(auth.organizationId);
    const body = createCompanySchema.parse(await request.json());
    const rows = await sql()`
      insert into crm_companies (
        organization_id, name, domain, industry, employee_count, annual_revenue, lifecycle_stage, health_score
      ) values (
        ${organizationId}, ${body.name}, ${body.domain ?? null}, ${body.industry ?? null}, ${body.employeeCount ?? null},
        ${body.annualRevenue ?? null}, ${body.lifecycleStage}, ${body.healthScore}
      )
      on conflict (organization_id, domain) do update set
        name = excluded.name,
        industry = excluded.industry,
        employee_count = excluded.employee_count,
        annual_revenue = excluded.annual_revenue,
        lifecycle_stage = excluded.lifecycle_stage,
        health_score = excluded.health_score,
        updated_at = now()
      returning id, name, domain, industry, employee_count, annual_revenue, lifecycle_stage, health_score, created_at, updated_at
    `;
    await writeAuditEvent({
      auth,
      action: "crm.companies.upsert",
      resourceType: "crm_company",
      resourceId: rows[0]?.id,
      purpose: "sales-operations",
      outcome: "success",
      userAgent: request.headers.get("user-agent"),
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

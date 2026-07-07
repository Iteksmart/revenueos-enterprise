import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";

const createContactSchema = z.object({
  companyId: z.string().uuid().nullable().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  authorityLevel: z.number().int().min(0).max(100).default(50),
});

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, "crm:read");
    const organizationId = requireOrganization(auth.organizationId);
    const rows = await sql()`
      select id, company_id, first_name, last_name, email, phone, title, authority_level, created_at, updated_at
      from crm_contacts
      where organization_id = ${organizationId}
      order by updated_at desc
      limit 100
    `;
    await writeAuditEvent({ auth, action: "crm.contacts.list", resourceType: "crm_contact", purpose: "relationship-management", outcome: "success" });
    return jsonOk(rows);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, "crm:write");
    const organizationId = requireOrganization(auth.organizationId);
    const body = createContactSchema.parse(await request.json());
    const rows = await sql()`
      insert into crm_contacts (
        organization_id, company_id, first_name, last_name, email, phone, title, authority_level
      ) values (
        ${organizationId}, ${body.companyId ?? null}, ${body.firstName}, ${body.lastName}, ${body.email ?? null},
        ${body.phone ?? null}, ${body.title ?? null}, ${body.authorityLevel}
      )
      on conflict (organization_id, email) do update set
        company_id = excluded.company_id,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        phone = excluded.phone,
        title = excluded.title,
        authority_level = excluded.authority_level,
        updated_at = now()
      returning id, company_id, first_name, last_name, email, phone, title, authority_level, created_at, updated_at
    `;
    await writeAuditEvent({ auth, action: "crm.contacts.upsert", resourceType: "crm_contact", resourceId: rows[0]?.id, purpose: "relationship-management", outcome: "success" });
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

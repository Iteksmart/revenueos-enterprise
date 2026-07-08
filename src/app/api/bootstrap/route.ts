import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";

const bootstrapSchema = z.object({
  organizationName: z.string().min(2).max(120).default("iTechSmart RevenueOS"),
  domain: z.string().min(3).max(255).nullable().optional(),
});

const adminPermissions = [
  "revenueos:admin",
  "crm:read",
  "crm:write",
  "campaigns:read",
  "campaigns:write",
  "leadscore:read",
  "leadscore:write",
  "audit:read",
  "ai:execute",
];

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const rows = await sql()`
      select
        u.id as user_id,
        u.organization_id,
        o.name as organization_name,
        o.domain,
        coalesce(array_agg(distinct r.name) filter (where r.name is not null), '{}') as roles,
        coalesce(array_agg(distinct permission) filter (where permission is not null), '{}') as permissions
      from revenueos_users u
      join revenueos_organizations o on o.id = u.organization_id
      left join revenueos_user_roles ur on ur.user_id = u.id
      left join revenueos_roles r on r.id = ur.role_id
      left join lateral unnest(r.permissions) as permission on true
      where u.external_subject = ${auth.subject}
      group by u.id, u.organization_id, o.name, o.domain
      order by u.created_at asc
      limit 1
    `;

    return jsonOk(rows[0] ?? null);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    const body = bootstrapSchema.parse(await readJson(request));
    const existing = await sql()`
      select u.id as user_id, u.organization_id, o.name as organization_name, o.domain
      from revenueos_users u
      join revenueos_organizations o on o.id = u.organization_id
      where u.external_subject = ${auth.subject}
      order by u.created_at asc
      limit 1
    `;

    if (existing[0]) {
      return jsonOk({
        created: false,
        userId: existing[0].user_id,
        organizationId: existing[0].organization_id,
        organizationName: existing[0].organization_name,
        domain: existing[0].domain,
      });
    }

    const email = auth.email ?? `${auth.subject}@revenueos.local`;
    const displayName = auth.name ?? email;
    const created = await sql().begin(async (transaction) => {
      const organizations = await transaction`
        insert into revenueos_organizations (name, domain)
        values (${body.organizationName}, ${body.domain ?? emailDomain(email)})
        on conflict (domain) do update set
          name = excluded.name,
          updated_at = now()
        returning id, name, domain
      `;
      const organization = organizations[0];
      const users = await transaction`
        insert into revenueos_users (organization_id, external_subject, email, display_name)
        values (${organization.id}, ${auth.subject}, ${email}, ${displayName})
        on conflict (organization_id, external_subject) do update set
          email = excluded.email,
          display_name = excluded.display_name
        returning id
      `;
      const roles = await transaction`
        insert into revenueos_roles (organization_id, name, permissions)
        values (${organization.id}, 'Owner', ${adminPermissions})
        on conflict (organization_id, name) do update set
          permissions = excluded.permissions
        returning id
      `;
      await transaction`
        insert into revenueos_user_roles (user_id, role_id)
        values (${users[0].id}, ${roles[0].id})
        on conflict do nothing
      `;

      return {
        userId: users[0].id,
        organizationId: organization.id,
        organizationName: organization.name,
        domain: organization.domain,
        roles: ["Owner"],
        permissions: adminPermissions,
      };
    });

    await writeAuditEvent({
      auth: { ...auth, organizationId: created.organizationId, permissions: new Set(adminPermissions) },
      action: "revenueos.bootstrap",
      resourceType: "revenueos_organization",
      resourceId: created.organizationId,
      purpose: "tenant-bootstrap",
      outcome: "success",
      userAgent: request.headers.get("user-agent"),
    });

    return jsonOk({ created: true, ...created }, 201);
  } catch (error) {
    return jsonError(error);
  }
}

async function readJson(request: Request) {
  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

function emailDomain(email: string) {
  const domain = email.split("@")[1];
  return domain && !domain.endsWith(".local") ? domain : null;
}

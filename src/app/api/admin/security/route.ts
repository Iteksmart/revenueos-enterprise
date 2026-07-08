import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";

const seedSchema = z.object({ seed: z.literal(true) });

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  mfaEnrolled: z.boolean().optional(),
  roleName: z.enum(["Owner", "Sales", "Customer Success", "Auditor", "Automation Operator"]).optional(),
});

const roleCatalog = [
  {
    name: "Owner",
    permissions: ["revenueos:admin", "crm:read", "crm:write", "campaigns:read", "campaigns:write", "leadscore:read", "leadscore:write", "audit:read", "ai:execute"],
  },
  {
    name: "Sales",
    permissions: ["crm:read", "crm:write", "campaigns:read", "leadscore:read", "ai:execute"],
  },
  {
    name: "Customer Success",
    permissions: ["crm:read", "crm:write", "audit:read", "ai:execute"],
  },
  {
    name: "Automation Operator",
    permissions: ["crm:read", "campaigns:read", "campaigns:write", "audit:read"],
  },
  {
    name: "Auditor",
    permissions: ["crm:read", "campaigns:read", "leadscore:read", "audit:read"],
  },
];

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, "revenueos:admin");
    const organizationId = requireOrganization(auth.organizationId);
    const [users, roles, summaryRows] = await Promise.all([
      sql()`
        select
          u.id,
          u.external_subject,
          u.email,
          u.display_name,
          u.mfa_enrolled,
          u.created_at,
          coalesce(array_agg(distinct r.name) filter (where r.name is not null), '{}') as roles,
          coalesce(array_agg(distinct permission) filter (where permission is not null), '{}') as permissions
        from revenueos_users u
        left join revenueos_user_roles ur on ur.user_id = u.id
        left join revenueos_roles r on r.id = ur.role_id
        left join lateral unnest(r.permissions) as permission on true
        where u.organization_id = ${organizationId}
        group by u.id
        order by u.created_at asc
      `,
      sql()`
        select id, name, permissions, created_at
        from revenueos_roles
        where organization_id = ${organizationId}
        order by name asc
      `,
      sql()`
        select
          count(*)::int as user_count,
          count(*) filter (where mfa_enrolled)::int as mfa_enrolled_count
        from revenueos_users
        where organization_id = ${organizationId}
      `,
    ]);

    await writeAuditEvent({
      auth,
      action: "admin.security.list",
      resourceType: "revenueos_security",
      purpose: "security-administration",
      outcome: "success",
      userAgent: request.headers.get("user-agent"),
    });

    return jsonOk({ summary: summaryRows[0], users, roles, roleCatalog });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, "revenueos:admin");
    const organizationId = requireOrganization(auth.organizationId);
    const payload = await request.json();

    if (seedSchema.safeParse(payload).success) {
      for (const role of roleCatalog) {
        await sql()`
          insert into revenueos_roles (organization_id, name, permissions)
          values (${organizationId}, ${role.name}, ${role.permissions})
          on conflict (organization_id, name) do update set
            permissions = excluded.permissions
        `;
      }
      await writeAuditEvent({
        auth,
        action: "admin.security.seed_roles",
        resourceType: "revenueos_role",
        purpose: "security-administration",
        outcome: "success",
        metadata: { roleCount: roleCatalog.length },
      });
      return jsonOk({ roleCount: roleCatalog.length }, 201);
    }

    const body = updateUserSchema.parse(payload);
    const rows = await sql().begin(async (transaction) => {
      if (body.mfaEnrolled !== undefined) {
        await transaction`
          update revenueos_users
          set mfa_enrolled = ${body.mfaEnrolled}
          where organization_id = ${organizationId} and id = ${body.userId}
        `;
      }

      if (body.roleName) {
        const roles = await transaction`
          select id from revenueos_roles
          where organization_id = ${organizationId} and name = ${body.roleName}
          limit 1
        `;
        if (roles[0]) {
          await transaction`
            insert into revenueos_user_roles (user_id, role_id)
            values (${body.userId}, ${roles[0].id})
            on conflict do nothing
          `;
        }
      }

      return transaction`
        select
          u.id,
          u.external_subject,
          u.email,
          u.display_name,
          u.mfa_enrolled,
          u.created_at,
          coalesce(array_agg(distinct r.name) filter (where r.name is not null), '{}') as roles,
          coalesce(array_agg(distinct permission) filter (where permission is not null), '{}') as permissions
        from revenueos_users u
        left join revenueos_user_roles ur on ur.user_id = u.id
        left join revenueos_roles r on r.id = ur.role_id
        left join lateral unnest(r.permissions) as permission on true
        where u.organization_id = ${organizationId} and u.id = ${body.userId}
        group by u.id
        limit 1
      `;
    });

    if (!rows[0]) {
      return jsonOk({ user: null, reason: "User not found" }, 404);
    }

    await writeAuditEvent({
      auth,
      action: "admin.security.update_user",
      resourceType: "revenueos_user",
      resourceId: rows[0].id,
      purpose: "security-administration",
      outcome: "success",
      metadata: { mfaEnrolled: body.mfaEnrolled, roleName: body.roleName },
    });
    return jsonOk(rows[0]);
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

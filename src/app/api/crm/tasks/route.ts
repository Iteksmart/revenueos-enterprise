import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";

const createTaskSchema = z.object({
  companyId: z.string().uuid().nullable().optional(),
  dealId: z.string().uuid().nullable().optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  title: z.string().min(2),
  status: z.enum(["open", "in_progress", "blocked", "done"]).default("open"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  dueAt: z.string().datetime().nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, "crm:read");
    const organizationId = requireOrganization(auth.organizationId);
    const rows = await sql()`
      select id, company_id, deal_id, assigned_user_id, title, status, priority, due_at, completed_at, created_at
      from crm_tasks
      where organization_id = ${organizationId}
      order by due_at asc nulls last, created_at desc
      limit 100
    `;
    await writeAuditEvent({ auth, action: "crm.tasks.list", resourceType: "crm_task", purpose: "task-management", outcome: "success" });
    return jsonOk(rows);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, "crm:write");
    const organizationId = requireOrganization(auth.organizationId);
    const body = createTaskSchema.parse(await request.json());
    const rows = await sql()`
      insert into crm_tasks (
        organization_id, company_id, deal_id, assigned_user_id, title, status, priority, due_at, completed_at
      ) values (
        ${organizationId}, ${body.companyId ?? null}, ${body.dealId ?? null}, ${body.assignedUserId ?? null},
        ${body.title}, ${body.status}, ${body.priority}, ${body.dueAt ?? null}, ${body.status === "done" ? new Date() : null}
      )
      returning id, company_id, deal_id, assigned_user_id, title, status, priority, due_at, completed_at, created_at
    `;
    await writeAuditEvent({ auth, action: "crm.tasks.create", resourceType: "crm_task", resourceId: rows[0]?.id, purpose: "task-management", outcome: "success" });
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

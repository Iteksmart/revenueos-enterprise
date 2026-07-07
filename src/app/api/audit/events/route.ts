import { requireAuth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, "audit:read");
    const rows = await sql()`
      select id, actor_subject, action, resource_type, resource_id, purpose, outcome, request_id, user_agent, metadata, created_at
      from audit_log_events
      where organization_id = ${auth.organizationId ?? null}
      order by created_at desc
      limit 200
    `;
    return jsonOk(rows);
  } catch (error) {
    return jsonError(error);
  }
}

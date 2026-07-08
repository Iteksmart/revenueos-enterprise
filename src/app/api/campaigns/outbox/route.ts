import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { processOutbox } from "@/lib/outbox-worker";
import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";

const processSchema = z.object({
  limit: z.number().int().min(1).max(25).default(10),
});

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, "campaigns:read");
    const organizationId = requireOrganization(auth.organizationId);
    const rows = await sql()`
      select
        o.id,
        o.campaign_id,
        c.name as campaign_name,
        o.step_id,
        s.step_order,
        s.action_type,
        o.channel,
        o.recipient,
        o.subject,
        o.status,
        o.scheduled_at,
        o.sent_at,
        o.error,
        o.created_at
      from notification_outbox o
      left join marketing_campaigns c on c.id = o.campaign_id
      left join campaign_steps s on s.id = o.step_id
      where o.organization_id = ${organizationId}
      order by o.scheduled_at asc, o.created_at desc
      limit 100
    `;
    return jsonOk(rows);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, "campaigns:write");
    const organizationId = requireOrganization(auth.organizationId);
    const body = processSchema.parse(await readJson(request));
    const result = await processOutbox({ limit: body.limit, mode: "dry-run", trigger: "app", organizationId });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}

async function readJson(request: Request) {
  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

function requireOrganization(organizationId?: string) {
  if (!organizationId) {
    throw new Error("Authenticated token must include org_id");
  }
  return organizationId;
}

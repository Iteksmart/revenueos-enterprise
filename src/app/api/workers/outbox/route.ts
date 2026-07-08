import { z } from "zod";
import { AuthError } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { serverEnv } from "@/lib/config";
import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";

const workerRequestSchema = z.object({
  limit: z.number().int().min(1).max(50).default(10),
  mode: z.enum(["dry-run", "send"]).default("dry-run"),
});

export async function POST(request: Request) {
  try {
    requireWorkerToken(request);
    const body = workerRequestSchema.parse(await readJson(request));
    const result = await sql().begin(async (transaction) => {
      const claimed = await transaction`
        update notification_outbox
        set status = 'processing',
            error = null,
            metadata = metadata || ${JSON.stringify({ claimedAt: new Date().toISOString(), workerMode: body.mode })}::jsonb
        where id in (
          select id
          from notification_outbox
          where status = 'queued'
            and scheduled_at <= now()
          order by scheduled_at asc, created_at asc
          limit ${body.limit}
          for update skip locked
        )
        returning id, organization_id, campaign_id, step_id, channel, recipient, subject, body, status, scheduled_at, metadata
      `;

      const processed = [];
      for (const item of claimed) {
        const delivery = await deliverOutboxItem(item, body.mode);
        const rows = await transaction`
          update notification_outbox
          set status = ${delivery.status},
              sent_at = case when ${delivery.status} = 'sent' then now() else sent_at end,
              error = ${delivery.error},
              metadata = metadata || ${JSON.stringify(delivery.metadata)}::jsonb
          where id = ${item.id}
          returning id, organization_id, campaign_id, step_id, channel, recipient, subject, status, scheduled_at, sent_at, error
        `;
        processed.push(rows[0]);
      }

      await transaction`
        update campaign_steps s
        set status = 'executed',
            executed_at = now()
        where s.id in (
          select distinct step_id
          from notification_outbox
          where step_id is not null
            and status = 'sent'
            and step_id = s.id
        )
      `;

      return { claimed: claimed.length, processed };
    });

    await writeAuditEvent({
      action: "workers.outbox.process",
      resourceType: "notification_outbox",
      purpose: "campaign-execution",
      outcome: "success",
      metadata: { mode: body.mode, claimed: result.claimed, processed: result.processed.length },
    });

    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}

function requireWorkerToken(request: Request) {
  const configured = serverEnv.REVENUEOS_WORKER_TOKEN;
  if (!configured) {
    throw new AuthError("REVENUEOS_WORKER_TOKEN is required for worker execution", 503);
  }

  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token || token !== configured) {
    throw new AuthError("Worker bearer token is required", 401);
  }
}

async function deliverOutboxItem(
  item: { channel?: unknown; recipient?: unknown; subject?: unknown; body?: unknown },
  mode: "dry-run" | "send",
) {
  const channel = typeof item.channel === "string" ? item.channel : "unknown";
  const recipient = typeof item.recipient === "string" ? item.recipient : "unknown";
  const subject = typeof item.subject === "string" ? item.subject : "Untitled";
  const messageBody = typeof item.body === "string" ? item.body : "";

  if (mode === "dry-run") {
    return {
      status: "sent",
      error: null,
      metadata: {
        deliveryMode: "dry-run",
        provider: "none",
        note: "No external message was transmitted.",
      },
    };
  }

  return {
    status: "failed",
    error: `No ${channel} provider adapter is configured yet.`,
    metadata: {
      deliveryMode: "send",
      provider: "unconfigured",
      recipient,
      subject,
      bodyLength: messageBody.length,
    },
  };
}

async function readJson(request: Request) {
  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

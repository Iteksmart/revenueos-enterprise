import { writeAuditEvent } from "./audit";
import { ConfigurationError, serverEnv } from "./config";
import { sql } from "./db";

export type OutboxWorkerMode = "dry-run" | "send";

type ProcessOutboxInput = {
  limit: number;
  mode: OutboxWorkerMode;
  trigger: "manual" | "cron" | "app";
  organizationId?: string;
};

export async function processOutbox(input: ProcessOutboxInput) {
  const result = await sql().begin(async (transaction) => {
    const claimed = await transaction`
      update notification_outbox
      set status = 'processing',
          error = null,
          metadata = metadata || ${JSON.stringify({
            claimedAt: new Date().toISOString(),
            workerMode: input.mode,
            trigger: input.trigger,
          })}::jsonb
      where id in (
        select id
        from notification_outbox
        where status = 'queued'
          and scheduled_at <= now()
          and (${input.organizationId ?? null} is null or organization_id = ${input.organizationId ?? null})
        order by scheduled_at asc, created_at asc
        limit ${input.limit}
        for update skip locked
      )
      returning id, organization_id, campaign_id, step_id, channel, recipient, subject, body, status, scheduled_at, metadata
    `;

    const processed = [];
    for (const item of claimed) {
      const delivery = await deliverOutboxItem(item, input.mode);
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
    action: input.trigger === "cron" ? "workers.outbox.cron" : input.trigger === "app" ? "workers.outbox.app_dry_run" : "workers.outbox.process",
    resourceType: "notification_outbox",
    purpose: "campaign-execution",
    outcome: "success",
    metadata: { mode: input.mode, claimed: result.claimed, processed: result.processed.length },
  });

  return result;
}

async function deliverOutboxItem(
  item: { channel?: unknown; recipient?: unknown; subject?: unknown; body?: unknown },
  mode: OutboxWorkerMode,
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

  if (channel === "email") {
    return sendResendEmail({ recipient, subject, messageBody });
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

async function sendResendEmail(input: { recipient: string; subject: string; messageBody: string }) {
  if (serverEnv.OUTBOUND_SEND_ENABLED !== "true") {
    return {
      status: "failed",
      error: "Outbound send mode is disabled. Set OUTBOUND_SEND_ENABLED=true after provider verification.",
      metadata: {
        deliveryMode: "send",
        provider: "resend",
        enabled: false,
        recipient: input.recipient,
        subject: input.subject,
        bodyLength: input.messageBody.length,
      },
    };
  }

  if (!serverEnv.RESEND_API_KEY || !serverEnv.RESEND_FROM_EMAIL) {
    return {
      status: "failed",
      error: "RESEND_API_KEY and RESEND_FROM_EMAIL are required for email delivery.",
      metadata: {
        deliveryMode: "send",
        provider: "resend",
        configured: false,
        recipient: input.recipient,
        subject: input.subject,
        bodyLength: input.messageBody.length,
      },
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${serverEnv.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: serverEnv.RESEND_FROM_EMAIL,
      to: [input.recipient],
      subject: input.subject,
      text: input.messageBody,
    }),
  });

  const payload = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
  if (!response.ok) {
    return {
      status: "failed",
      error: payload.message ?? `Resend delivery failed with status ${response.status}`,
      metadata: {
        deliveryMode: "send",
        provider: "resend",
        providerStatus: response.status,
        providerErrorName: payload.name,
        recipient: input.recipient,
        subject: input.subject,
        bodyLength: input.messageBody.length,
      },
    };
  }

  if (!payload.id) {
    throw new ConfigurationError("Resend accepted the request but did not return a message id");
  }

  return {
    status: "sent",
    error: null,
    metadata: {
      deliveryMode: "send",
      provider: "resend",
      providerMessageId: payload.id,
      recipient: input.recipient,
      subject: input.subject,
      bodyLength: input.messageBody.length,
    },
  };
}

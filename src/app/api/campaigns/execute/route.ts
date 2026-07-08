import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";

const executeCampaignSchema = z.object({
  campaignId: z.string().uuid(),
  recipients: z.array(z.string().email()).min(1).max(25).default(["kevin@itechsmart.dev"]),
});

const defaultSteps = [
  {
    stepOrder: 1,
    triggerType: "campaign_start",
    actionType: "send_value_email",
    channel: "email",
    delayDays: 0,
    subject: "A cleaner accountability layer for IT decisions",
    body: "RevenueOS queued the first value email with ProofLink-backed accountability positioning.",
  },
  {
    stepOrder: 2,
    triggerType: "opened_email",
    actionType: "wait_then_follow_up",
    channel: "email",
    delayDays: 2,
    subject: "Follow-up: audit receipts for managed IT",
    body: "RevenueOS queued a non-spam follow-up based on engagement and consent policy.",
  },
  {
    stepOrder: 3,
    triggerType: "clicked_email",
    actionType: "create_sales_task",
    channel: "task",
    delayDays: 0,
    subject: "Create sales task",
    body: "RevenueOS queued a sales task to increase score and notify the owner.",
  },
];

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, "campaigns:write");
    const organizationId = requireOrganization(auth.organizationId);
    const body = executeCampaignSchema.parse(await request.json());
    const campaigns = await sql()`
      select id, name, segment, status, cadence_days, consent_policy
      from marketing_campaigns
      where organization_id = ${organizationId} and id = ${body.campaignId}
      limit 1
    `;
    const campaign = campaigns[0];
    if (!campaign) {
      return jsonOk({ campaign: null, reason: "Campaign not found" }, 404);
    }

    const queued = await sql().begin(async (transaction) => {
      await transaction`
        update marketing_campaigns
        set status = 'running'
        where organization_id = ${organizationId} and id = ${body.campaignId}
      `;

      const stepRows = [];
      for (const step of defaultSteps) {
        const rows = await transaction`
          insert into campaign_steps (
            organization_id, campaign_id, step_order, trigger_type, action_type, channel, delay_days, status, payload, scheduled_at
          ) values (
            ${organizationId}, ${body.campaignId}, ${step.stepOrder}, ${step.triggerType}, ${step.actionType},
            ${step.channel}, ${step.delayDays}, 'queued',
            ${JSON.stringify({ segment: campaign.segment, consentPolicy: campaign.consent_policy })},
            now() + make_interval(days => ${step.delayDays})
          )
          on conflict (campaign_id, step_order) do update set
            trigger_type = excluded.trigger_type,
            action_type = excluded.action_type,
            channel = excluded.channel,
            delay_days = excluded.delay_days,
            status = 'queued',
            payload = excluded.payload,
            scheduled_at = excluded.scheduled_at
          returning id, step_order, trigger_type, action_type, channel, delay_days, status, scheduled_at
        `;
        const stepRow = rows[0];
        stepRows.push(stepRow);

        for (const recipient of body.recipients) {
          await transaction`
            insert into notification_outbox (
              organization_id, campaign_id, step_id, channel, recipient, subject, body, status, scheduled_at, metadata
            ) values (
              ${organizationId}, ${body.campaignId}, ${stepRow.id}, ${step.channel}, ${recipient},
              ${step.subject}, ${step.body}, 'queued', ${stepRow.scheduled_at},
              ${JSON.stringify({ triggerType: step.triggerType, actionType: step.actionType, campaignName: campaign.name })}
            )
          `;
        }
      }

      const outboxRows = await transaction`
        select id, channel, recipient, subject, status, scheduled_at, created_at
        from notification_outbox
        where organization_id = ${organizationId} and campaign_id = ${body.campaignId}
        order by scheduled_at asc, created_at desc
        limit 100
      `;

      return { steps: stepRows, outbox: outboxRows };
    });

    await writeAuditEvent({
      auth,
      action: "campaigns.execute.queue",
      resourceType: "marketing_campaign",
      resourceId: body.campaignId,
      purpose: "campaign-execution",
      outcome: "success",
      metadata: { stepCount: queued.steps.length, outboxCount: queued.outbox.length },
    });

    return jsonOk({ campaignId: body.campaignId, status: "running", ...queued }, 201);
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

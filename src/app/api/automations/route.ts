import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";

const seedSchema = z.object({ seed: z.literal(true) });

const createRuleSchema = z.object({
  name: z.string().trim().min(2).max(140),
  triggerEvent: z.enum(["email_opened", "email_clicked", "proposal_viewed", "customer_at_risk", "renewal_due"]),
  conditionField: z.string().trim().min(2).max(80).default("event.type"),
  conditionOperator: z.enum(["equals", "not_equals"]).default("equals"),
  conditionValue: z.string().trim().min(1).max(160),
  actionType: z.enum(["queue_follow_up", "create_task", "increase_score", "notify_sales"]),
  actionConfig: z.record(z.string(), z.unknown()).default({}),
});

const runEventSchema = z.object({
  eventType: z.enum(["email_opened", "email_clicked", "proposal_viewed", "customer_at_risk", "renewal_due"]),
  companyId: z.string().uuid().nullable().optional(),
  dealId: z.string().uuid().nullable().optional(),
  campaignId: z.string().uuid().nullable().optional(),
  recipient: z.string().email().nullable().optional(),
  subject: z.string().trim().max(180).nullable().optional(),
});

type AutomationRuleRow = {
  id: string;
  name: string;
  action_type: string;
  action_config: Record<string, unknown>;
};

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, "campaigns:read");
    const organizationId = requireOrganization(auth.organizationId);
    const rules = await sql()`
      select
        r.id,
        r.name,
        r.status,
        r.trigger_event,
        r.condition_field,
        r.condition_operator,
        r.condition_value,
        r.action_type,
        r.action_config,
        r.run_count,
        r.last_run_at,
        r.created_at,
        coalesce(recent.run_count, 0)::int as recent_run_count
      from automation_rules r
      left join lateral (
        select count(*) as run_count
        from automation_runs ar
        where ar.rule_id = r.id and ar.created_at >= now() - interval '7 days'
      ) recent on true
      where r.organization_id = ${organizationId}
      order by r.created_at desc
      limit 100
    `;
    const runs = await sql()`
      select id, rule_id, event_type, outcome, resource_type, resource_id, metadata, created_at
      from automation_runs
      where organization_id = ${organizationId}
      order by created_at desc
      limit 30
    `;
    await writeAuditEvent({
      auth,
      action: "automations.list",
      resourceType: "automation_rule",
      purpose: "automation",
      outcome: "success",
    });
    return jsonOk({ rules, runs });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, "campaigns:write");
    const organizationId = requireOrganization(auth.organizationId);
    const payload = await request.json();

    if (seedSchema.safeParse(payload).success) {
      const result = await seedRules(organizationId);
      await writeAuditEvent({
        auth,
        action: "automations.seed",
        resourceType: "automation_rule",
        purpose: "automation",
        outcome: "success",
        metadata: result,
      });
      return jsonOk(result, 201);
    }

    if ("eventType" in payload) {
      const body = runEventSchema.parse(payload);
      const result = await runAutomationEvent(organizationId, body);
      await writeAuditEvent({
        auth,
        action: "automations.run_event",
        resourceType: "automation_run",
        purpose: "automation",
        outcome: "success",
        metadata: { eventType: body.eventType, executed: result.executed },
      });
      return jsonOk(result, 201);
    }

    const body = createRuleSchema.parse(payload);
    const rows = await sql()`
      insert into automation_rules (
        organization_id, name, trigger_event, condition_field, condition_operator, condition_value, action_type, action_config
      ) values (
        ${organizationId}, ${body.name}, ${body.triggerEvent}, ${body.conditionField}, ${body.conditionOperator},
        ${body.conditionValue}, ${body.actionType}, ${JSON.stringify(body.actionConfig)}
      )
      on conflict (organization_id, name) do update set
        trigger_event = excluded.trigger_event,
        condition_field = excluded.condition_field,
        condition_operator = excluded.condition_operator,
        condition_value = excluded.condition_value,
        action_type = excluded.action_type,
        action_config = excluded.action_config,
        status = 'active',
        updated_at = now()
      returning id, name, status, trigger_event, condition_field, condition_operator, condition_value, action_type, action_config, run_count, last_run_at, created_at
    `;
    await writeAuditEvent({
      auth,
      action: "automations.rule.upsert",
      resourceType: "automation_rule",
      resourceId: rows[0]?.id,
      purpose: "automation",
      outcome: "success",
    });
    return jsonOk(rows[0], 201);
  } catch (error) {
    return jsonError(error);
  }
}

async function seedRules(organizationId: string) {
  const defaults = [
    {
      name: "Opened email -> queue follow-up",
      triggerEvent: "email_opened",
      conditionValue: "email_opened",
      actionType: "queue_follow_up",
      actionConfig: {
        delayDays: 2,
        subject: "Follow-up from iTechSmart RevenueOS",
        body: "RevenueOS queued this follow-up because the contact opened the campaign email.",
      },
    },
    {
      name: "Clicked email -> create sales task",
      triggerEvent: "email_clicked",
      conditionValue: "email_clicked",
      actionType: "create_task",
      actionConfig: {
        title: "Call engaged lead from campaign click",
        priority: "high",
      },
    },
    {
      name: "Proposal viewed -> notify sales",
      triggerEvent: "proposal_viewed",
      conditionValue: "proposal_viewed",
      actionType: "notify_sales",
      actionConfig: {
        title: "Proposal viewed: follow up today",
        priority: "urgent",
      },
    },
  ];

  for (const rule of defaults) {
    await sql()`
      insert into automation_rules (
        organization_id, name, trigger_event, condition_value, action_type, action_config
      ) values (
        ${organizationId}, ${rule.name}, ${rule.triggerEvent}, ${rule.conditionValue}, ${rule.actionType},
        ${JSON.stringify(rule.actionConfig)}
      )
      on conflict (organization_id, name) do update set
        trigger_event = excluded.trigger_event,
        condition_value = excluded.condition_value,
        action_type = excluded.action_type,
        action_config = excluded.action_config,
        status = 'active',
        updated_at = now()
    `;
  }

  return { ruleCount: defaults.length };
}

async function runAutomationEvent(organizationId: string, event: z.infer<typeof runEventSchema>) {
  const rules = await sql()`
    select id, name, action_type, action_config
    from automation_rules
    where organization_id = ${organizationId}
      and status = 'active'
      and trigger_event = ${event.eventType}
      and condition_operator = 'equals'
      and condition_value = ${event.eventType}
    order by created_at asc
  `;
  const matchedRules = rules as unknown as AutomationRuleRow[];

  const executed = [];
  for (const rule of matchedRules) {
    const action = await executeRuleAction(organizationId, rule, event);
    await sql().begin(async (transaction) => {
      await transaction`
        update automation_rules
        set run_count = run_count + 1,
            last_run_at = now(),
            updated_at = now()
        where id = ${rule.id}
      `;
      await transaction`
        insert into automation_runs (
          organization_id, rule_id, event_type, outcome, resource_type, resource_id, metadata
        ) values (
          ${organizationId}, ${rule.id}, ${event.eventType}, ${action.outcome}, ${action.resourceType},
          ${action.resourceId}, ${JSON.stringify(action.metadata)}
        )
      `;
    });
    executed.push({ ruleId: rule.id, ruleName: rule.name, ...action });
  }

  return { eventType: event.eventType, matched: matchedRules.length, executed };
}

async function executeRuleAction(
  organizationId: string,
  rule: { id: string; name: string; action_type: string; action_config: Record<string, unknown> },
  event: z.infer<typeof runEventSchema>,
) {
  const config = rule.action_config ?? {};
  if (rule.action_type === "queue_follow_up") {
    if (!event.recipient) {
      return { outcome: "skipped", resourceType: "notification_outbox", resourceId: null, metadata: { reason: "recipient missing" } };
    }
    const rows = await sql()`
      insert into notification_outbox (
        organization_id, campaign_id, channel, recipient, subject, body, status, scheduled_at, metadata
      ) values (
        ${organizationId}, ${event.campaignId ?? null}, 'email', ${event.recipient},
        ${stringConfig(config.subject, event.subject ?? "RevenueOS follow-up")},
        ${stringConfig(config.body, "RevenueOS queued this automated follow-up.")},
        'queued',
        now() + make_interval(days => ${numberConfig(config.delayDays, 2)}),
        ${JSON.stringify({ automationRuleId: rule.id, eventType: event.eventType })}
      )
      returning id
    `;
    return { outcome: "success", resourceType: "notification_outbox", resourceId: rows[0].id, metadata: { actionType: rule.action_type } };
  }

  if (rule.action_type === "create_task" || rule.action_type === "notify_sales") {
    const rows = await sql()`
      insert into crm_tasks (
        organization_id, company_id, deal_id, title, status, priority, due_at
      ) values (
        ${organizationId}, ${event.companyId ?? null}, ${event.dealId ?? null},
        ${stringConfig(config.title, "RevenueOS automation follow-up")},
        'open',
        ${stringConfig(config.priority, rule.action_type === "notify_sales" ? "urgent" : "high")},
        now() + interval '1 day'
      )
      returning id
    `;
    return { outcome: "success", resourceType: "crm_task", resourceId: rows[0].id, metadata: { actionType: rule.action_type } };
  }

  return { outcome: "skipped", resourceType: "automation_rule", resourceId: rule.id, metadata: { reason: "unsupported action" } };
}

function stringConfig(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberConfig(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function requireOrganization(organizationId?: string) {
  if (!organizationId) {
    throw new Error("Authenticated token must include org_id");
  }
  return organizationId;
}

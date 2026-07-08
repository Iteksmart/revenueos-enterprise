import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";

const createAccountSchema = z.object({
  companyId: z.string().uuid(),
  mrr: z.number().nonnegative().default(0),
  healthStatus: z.enum(["excellent", "stable", "watch", "at_risk"]).default("stable"),
  onboardingStatus: z.enum(["not_started", "implementation", "live", "expansion"]).default("implementation"),
  renewalDate: z.string().date().nullable().optional(),
  renewalRisk: z.number().int().min(0).max(100).default(45),
  executiveSponsor: z.string().trim().min(2).max(160).nullable().optional(),
  successPlan: z.string().trim().max(2000).default(""),
});

const touchpointSchema = z.object({
  accountId: z.string().uuid(),
  touchpointType: z.enum(["qbr", "support", "onboarding", "renewal", "risk_review", "expansion"]),
  summary: z.string().trim().min(2).max(2000),
  sentiment: z.enum(["positive", "neutral", "negative"]).default("neutral"),
  nextAction: z.string().trim().max(500).nullable().optional(),
});

const seedSchema = z.object({
  seed: z.literal(true),
});

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, "crm:read");
    const organizationId = requireOrganization(auth.organizationId);
    const accounts = await sql()`
      select
        a.id,
        a.company_id,
        c.name as company_name,
        c.industry,
        c.health_score as crm_health_score,
        a.mrr,
        a.arr,
        a.health_status,
        a.onboarding_status,
        a.renewal_date,
        a.renewal_risk,
        a.executive_sponsor,
        a.success_plan,
        a.last_touch_at,
        a.next_review_at,
        coalesce(t.touchpoint_count, 0)::int as touchpoint_count,
        coalesce(p.open_tickets, 0)::int as open_tickets,
        coalesce(p.open_projects, 0)::int as open_projects,
        coalesce(p.open_documents, 0)::int as open_documents,
        coalesce(p.open_renewals, 0)::int as open_renewals
      from customer_success_accounts a
      join crm_companies c on c.id = a.company_id
      left join lateral (
        select count(*) as touchpoint_count
        from customer_success_touchpoints t
        where t.account_id = a.id
      ) t on true
      left join lateral (
        select
          count(*) filter (where item_type = 'ticket' and status <> 'closed') as open_tickets,
          count(*) filter (where item_type = 'project' and status <> 'closed') as open_projects,
          count(*) filter (where item_type = 'document' and status <> 'closed') as open_documents,
          count(*) filter (where item_type = 'renewal' and status <> 'closed') as open_renewals
        from customer_portal_items p
        where p.account_id = a.id
      ) p on true
      where a.organization_id = ${organizationId}
      order by a.renewal_risk desc, a.renewal_date asc nulls last, a.updated_at desc
      limit 100
    `;

    const summaryRows = await sql()`
      select
        count(*)::int as account_count,
        coalesce(sum(mrr), 0) as mrr,
        coalesce(sum(arr), 0) as arr,
        coalesce(avg(renewal_risk), 0)::int as avg_renewal_risk,
        count(*) filter (where health_status = 'at_risk')::int as at_risk_count,
        count(*) filter (where renewal_date between current_date and current_date + interval '90 days')::int as renewals_90_days
      from customer_success_accounts
      where organization_id = ${organizationId}
    `;

    await writeAuditEvent({
      auth,
      action: "customer_success.accounts.list",
      resourceType: "customer_success_account",
      purpose: "customer-success",
      outcome: "success",
      userAgent: request.headers.get("user-agent"),
    });

    return jsonOk({ summary: summaryRows[0], accounts });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, "crm:write");
    const organizationId = requireOrganization(auth.organizationId);
    const payload = await request.json();

    if (seedSchema.safeParse(payload).success) {
      const result = await seedCustomerSuccess(organizationId);
      await writeAuditEvent({
        auth,
        action: "customer_success.seed",
        resourceType: "customer_success_account",
        purpose: "customer-success",
        outcome: "success",
        metadata: result,
      });
      return jsonOk(result, 201);
    }

    if ("touchpointType" in payload) {
      const body = touchpointSchema.parse(payload);
      const rows = await sql().begin(async (transaction) => {
        const touchpoints = await transaction`
          insert into customer_success_touchpoints (
            organization_id, account_id, touchpoint_type, summary, sentiment, next_action
          ) values (
            ${organizationId}, ${body.accountId}, ${body.touchpointType}, ${body.summary},
            ${body.sentiment}, ${body.nextAction ?? null}
          )
          returning id, account_id, touchpoint_type, summary, sentiment, next_action, occurred_at
        `;
        await transaction`
          update customer_success_accounts
          set last_touch_at = now(),
              next_review_at = now() + interval '30 days',
              updated_at = now()
          where organization_id = ${organizationId} and id = ${body.accountId}
        `;
        return touchpoints;
      });
      await writeAuditEvent({
        auth,
        action: "customer_success.touchpoint.create",
        resourceType: "customer_success_touchpoint",
        resourceId: rows[0]?.id,
        purpose: "customer-success",
        outcome: "success",
      });
      return jsonOk(rows[0], 201);
    }

    const body = createAccountSchema.parse(payload);
    const rows = await sql()`
      insert into customer_success_accounts (
        organization_id, company_id, mrr, health_status, onboarding_status, renewal_date,
        renewal_risk, executive_sponsor, success_plan, next_review_at
      ) values (
        ${organizationId}, ${body.companyId}, ${body.mrr}, ${body.healthStatus}, ${body.onboardingStatus},
        ${body.renewalDate ?? null}, ${body.renewalRisk}, ${body.executiveSponsor ?? null}, ${body.successPlan},
        now() + interval '30 days'
      )
      on conflict (organization_id, company_id) do update set
        mrr = excluded.mrr,
        health_status = excluded.health_status,
        onboarding_status = excluded.onboarding_status,
        renewal_date = excluded.renewal_date,
        renewal_risk = excluded.renewal_risk,
        executive_sponsor = excluded.executive_sponsor,
        success_plan = excluded.success_plan,
        next_review_at = excluded.next_review_at,
        updated_at = now()
      returning id, company_id, mrr, arr, health_status, onboarding_status, renewal_date, renewal_risk, executive_sponsor, success_plan, last_touch_at, next_review_at
    `;

    await writeAuditEvent({
      auth,
      action: "customer_success.account.upsert",
      resourceType: "customer_success_account",
      resourceId: rows[0]?.id,
      purpose: "customer-success",
      outcome: "success",
    });

    return jsonOk(rows[0], 201);
  } catch (error) {
    return jsonError(error);
  }
}

async function seedCustomerSuccess(organizationId: string) {
  const companies = await sql()`
    select id, name, health_score, annual_revenue
    from crm_companies
    where organization_id = ${organizationId}
    order by created_at asc
    limit 6
  `;

  const accounts = [];
  for (const [index, company] of companies.entries()) {
    const risk = Math.max(12, 100 - Number(company.health_score ?? 50) + index * 8);
    const mrr = Math.max(1800, Math.round(Number(company.annual_revenue ?? 0) / 1200) || 3500 + index * 900);
    const status = risk >= 65 ? "at_risk" : risk >= 45 ? "watch" : Number(company.health_score ?? 0) >= 88 ? "excellent" : "stable";
    const rows = await sql().begin(async (transaction) => {
      const accountRows = await transaction`
        insert into customer_success_accounts (
          organization_id, company_id, mrr, health_status, onboarding_status, renewal_date,
          renewal_risk, executive_sponsor, success_plan, last_touch_at, next_review_at
        ) values (
          ${organizationId}, ${company.id}, ${mrr}, ${status}, ${index === 0 ? "live" : "implementation"},
          current_date + make_interval(days => ${45 + index * 24}), ${risk},
          ${index === 0 ? "CIO" : index === 1 ? "Managing Partner" : "Operations Director"},
          ${`Success plan for ${company.name}: prove accountability, reduce service ambiguity, and prepare a renewal/expansion review.`},
          now() - make_interval(days => ${index + 1}), now() + make_interval(days => ${21 + index * 7})
        )
        on conflict (organization_id, company_id) do update set
          mrr = excluded.mrr,
          health_status = excluded.health_status,
          onboarding_status = excluded.onboarding_status,
          renewal_date = excluded.renewal_date,
          renewal_risk = excluded.renewal_risk,
          executive_sponsor = excluded.executive_sponsor,
          success_plan = excluded.success_plan,
          last_touch_at = excluded.last_touch_at,
          next_review_at = excluded.next_review_at,
          updated_at = now()
        returning id, company_id, mrr, arr, health_status, onboarding_status, renewal_date, renewal_risk
      `;
      const account = accountRows[0];
      await transaction`
        insert into customer_success_touchpoints (
          organization_id, account_id, touchpoint_type, summary, sentiment, next_action
        ) values (
          ${organizationId}, ${account.id}, ${index === 0 ? "qbr" : "onboarding"},
          ${`${company.name} success check logged. Confirmed ProofLink accountability value and next operating review.`},
          ${risk >= 65 ? "negative" : "positive"},
          ${risk >= 65 ? "Schedule executive risk review" : "Prepare renewal value summary"}
        )
      `;
      await transaction`
        insert into customer_portal_items (
          organization_id, account_id, item_type, title, status, due_at, metadata
        ) values
          (${organizationId}, ${account.id}, 'ticket', ${`${company.name} onboarding/support checkpoint`}, 'open', now() + interval '3 days', ${JSON.stringify({ source: "seed" })}),
          (${organizationId}, ${account.id}, 'project', ${`${company.name} accountability rollout`}, 'active', now() + interval '14 days', ${JSON.stringify({ source: "seed" })}),
          (${organizationId}, ${account.id}, 'document', ${`${company.name} QBR evidence packet`}, 'open', now() + interval '21 days', ${JSON.stringify({ source: "seed" })}),
          (${organizationId}, ${account.id}, 'renewal', ${`${company.name} renewal review`}, 'open', current_date + make_interval(days => ${45 + index * 24}), ${JSON.stringify({ source: "seed" })})
      `;
      return account;
    });
    accounts.push(rows);
  }

  return { accountCount: accounts.length };
}

function requireOrganization(organizationId?: string) {
  if (!organizationId) {
    throw new Error("Authenticated token must include org_id");
  }
  return organizationId;
}

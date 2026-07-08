import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";

type ProposalCreateRow = {
  id: string;
  deal_id: string;
  quote_id: string;
  title: string;
  status: string;
  version: number;
  offer: string;
  terms: string;
  proposal_body: string;
  generated_by: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

const createProposalSchema = z.object({
  dealId: z.string().uuid(),
  title: z.string().trim().min(2).max(180).optional(),
  offer: z.string().trim().min(4).max(2000),
  terms: z.string().trim().min(4).max(2000),
  proposalBody: z.string().trim().min(10).max(20000),
  subtotal: z.number().nonnegative().optional(),
  tax: z.number().nonnegative().default(0),
  expiresInDays: z.number().int().min(1).max(180).default(30),
});

const updateProposalSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["draft", "sent", "viewed", "accepted", "expired", "withdrawn"]),
});

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, "crm:read");
    const organizationId = requireOrganization(auth.organizationId);
    const rows = await sql()`
      select
        p.id,
        p.deal_id,
        p.quote_id,
        p.title,
        p.status,
        p.version,
        p.offer,
        p.terms,
        p.proposal_body,
        p.generated_by,
        p.viewed_at,
        p.sent_at,
        p.accepted_at,
        p.expires_at,
        p.created_at,
        p.updated_at,
        d.name as deal_name,
        d.amount as deal_amount,
        c.name as company_name,
        q.quote_number,
        q.subtotal,
        q.tax,
        q.total
      from proposal_artifacts p
      join crm_deals d on d.id = p.deal_id
      join crm_companies c on c.id = d.company_id
      left join crm_quotes q on q.id = p.quote_id
      where p.organization_id = ${organizationId}
      order by p.updated_at desc
      limit 100
    `;
    await writeAuditEvent({
      auth,
      action: "proposals.list",
      resourceType: "proposal_artifact",
      purpose: "proposal-management",
      outcome: "success",
    });
    return jsonOk(rows);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, "crm:write");
    const organizationId = requireOrganization(auth.organizationId);
    const body = createProposalSchema.parse(await request.json());
    const rows = await sql().begin(async (transaction): Promise<ProposalCreateRow[]> => {
      const deals = await transaction`
        select d.id, d.name, d.amount, c.name as company_name
        from crm_deals d
        join crm_companies c on c.id = d.company_id
        where d.organization_id = ${organizationId} and d.id = ${body.dealId}
        limit 1
      `;
      const deal = deals[0];
      if (!deal) {
        return [];
      }

      const quoteNumber = `REV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      const quoteRows = await transaction`
        insert into crm_quotes (
          organization_id, deal_id, quote_number, status, subtotal, tax
        ) values (
          ${organizationId}, ${body.dealId}, ${quoteNumber}, 'draft',
          ${body.subtotal ?? Number(deal.amount ?? 0)}, ${body.tax}
        )
        returning id, quote_number, subtotal, tax, total
      `;
      const latest = await transaction`
        select coalesce(max(version), 0)::int + 1 as next_version
        from proposal_artifacts
        where organization_id = ${organizationId} and deal_id = ${body.dealId}
      `;
      const proposals = await transaction`
        insert into proposal_artifacts (
          organization_id, deal_id, quote_id, title, status, version, offer, terms, proposal_body, expires_at
        ) values (
          ${organizationId}, ${body.dealId}, ${quoteRows[0].id},
          ${body.title ?? `${deal.company_name} - ${deal.name} Proposal`},
          'draft', ${latest[0].next_version}, ${body.offer}, ${body.terms}, ${body.proposalBody},
          now() + make_interval(days => ${body.expiresInDays})
        )
        returning id, deal_id, quote_id, title, status, version, offer, terms, proposal_body, generated_by, expires_at, created_at, updated_at
      `;
      return proposals as unknown as ProposalCreateRow[];
    });

    if (!rows[0]) {
      return jsonOk({ proposal: null, reason: "Deal not found" }, 404);
    }

    await writeAuditEvent({
      auth,
      action: "proposals.create",
      resourceType: "proposal_artifact",
      resourceId: rows[0].id,
      purpose: "proposal-management",
      outcome: "success",
      metadata: { dealId: body.dealId, version: rows[0].version },
    });
    return jsonOk(rows[0], 201);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth(request, "crm:write");
    const organizationId = requireOrganization(auth.organizationId);
    const body = updateProposalSchema.parse(await request.json());
    const rows = await sql()`
      update proposal_artifacts set
        status = ${body.status},
        sent_at = case when ${body.status} = 'sent' then coalesce(sent_at, now()) else sent_at end,
        viewed_at = case when ${body.status} = 'viewed' then coalesce(viewed_at, now()) else viewed_at end,
        accepted_at = case when ${body.status} = 'accepted' then coalesce(accepted_at, now()) else accepted_at end,
        updated_at = now()
      where organization_id = ${organizationId} and id = ${body.id}
      returning id, deal_id, quote_id, title, status, version, sent_at, viewed_at, accepted_at, updated_at
    `;
    if (!rows[0]) {
      return jsonOk({ proposal: null, reason: "Proposal not found" }, 404);
    }

    await writeAuditEvent({
      auth,
      action: "proposals.update",
      resourceType: "proposal_artifact",
      resourceId: rows[0].id,
      purpose: "proposal-management",
      outcome: "success",
      metadata: { status: body.status },
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

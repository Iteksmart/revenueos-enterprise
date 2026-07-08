import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { runRevenueAgent } from "@/lib/ai";
import { writeAuditEvent } from "@/lib/audit";
import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";

const requestSchema = z.object({
  dealId: z.string().uuid(),
  offer: z.string().min(4),
  terms: z.string().min(4),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, "ai:execute");
    const organizationId = requireOrganization(auth.organizationId);
    const body = requestSchema.parse(await request.json());
    const deals = await sql()`
      select d.id, d.name, d.stage, d.amount, d.probability, d.close_date, c.name as company_name, c.industry
      from crm_deals d
      join crm_companies c on c.id = d.company_id
      where d.organization_id = ${organizationId} and d.id = ${body.dealId}
      limit 1
    `;
    if (!deals[0]) {
      return jsonOk({ proposal: null, reason: "Deal not found" }, 404);
    }

    const proposal = await runRevenueAgent([
      {
        role: "system",
        content: "You are RevenueOS proposal builder. Return an executive-ready proposal with summary, scope, deliverables, timeline, commercial terms, proof/audit posture, and next steps.",
      },
      {
        role: "user",
        content: JSON.stringify({ deal: deals[0], offer: body.offer, terms: body.terms }),
      },
    ]);

    const artifact = await sql().begin(async (transaction) => {
      const quoteNumber = `REV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      const quoteRows = await transaction`
        insert into crm_quotes (
          organization_id, deal_id, quote_number, status, subtotal, tax
        ) values (
          ${organizationId}, ${body.dealId}, ${quoteNumber}, 'draft', ${Number(deals[0].amount ?? 0)}, 0
        )
        returning id, quote_number, subtotal, tax, total
      `;
      const latest = await transaction`
        select coalesce(max(version), 0)::int + 1 as next_version
        from proposal_artifacts
        where organization_id = ${organizationId} and deal_id = ${body.dealId}
      `;
      const proposalRows = await transaction`
        insert into proposal_artifacts (
          organization_id, deal_id, quote_id, title, status, version, offer, terms, proposal_body, expires_at
        ) values (
          ${organizationId}, ${body.dealId}, ${quoteRows[0].id},
          ${`${deals[0].company_name} - ${deals[0].name} Proposal`},
          'draft', ${latest[0].next_version}, ${body.offer}, ${body.terms}, ${proposal}, now() + interval '30 days'
        )
        returning id, title, status, version, quote_id, expires_at, created_at
      `;
      return { proposal: proposalRows[0], quote: quoteRows[0] };
    });

    await writeAuditEvent({
      auth,
      action: "ai.proposal.generate",
      resourceType: "crm_deal",
      resourceId: body.dealId,
      purpose: "proposal-generation",
      outcome: "success",
      metadata: { proposalId: artifact.proposal.id, quoteId: artifact.quote.id },
    });
    return jsonOk({ proposal, artifact });
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

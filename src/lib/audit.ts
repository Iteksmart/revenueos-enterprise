import { sql } from "./db";
import type { AuthContext } from "./auth";

type AuditInput = {
  auth?: AuthContext;
  action: string;
  resourceType: string;
  resourceId?: string;
  purpose: string;
  outcome: "success" | "denied" | "error";
  requestId?: string;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAuditEvent(input: AuditInput) {
  const metadata = JSON.stringify(input.metadata ?? {});
  await sql()`
    insert into audit_log_events (
      organization_id,
      actor_subject,
      action,
      resource_type,
      resource_id,
      purpose,
      outcome,
      request_id,
      user_agent,
      metadata
    ) values (
      ${input.auth?.organizationId ?? null},
      ${input.auth?.subject ?? null},
      ${input.action},
      ${input.resourceType},
      ${input.resourceId ?? null},
      ${input.purpose},
      ${input.outcome},
      ${input.requestId ?? null},
      ${input.userAgent ?? null},
      ${metadata}
    )
  `;
}

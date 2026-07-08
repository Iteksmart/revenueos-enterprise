import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit";
import { canSendEmail, getEmailProviderStatus, sendResendEmail } from "@/lib/email-provider";
import { jsonError, jsonOk } from "@/lib/responses";
import { requireWorkerToken } from "@/lib/worker-auth";

const confirmationPhrase = "SEND_REVENUEOS_TEST_EMAIL";

const testEmailSchema = z.object({
  recipient: z.string().email(),
  subject: z.string().trim().min(1).max(180).default("RevenueOS Resend delivery test"),
  messageBody: z.string().trim().min(1).max(2000).default(
    "RevenueOS test email. This confirms the Resend provider path is wired for iTechSmart RevenueOS.",
  ),
  dryRun: z.boolean().default(true),
  confirmation: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    requireWorkerToken(request);
    const body = testEmailSchema.parse(await readJson(request));
    const provider = getEmailProviderStatus();

    if (body.dryRun) {
      await writeAuditEvent({
        action: "workers.email.test.dry_run",
        resourceType: "email_provider",
        purpose: "provider-verification",
        outcome: "success",
        metadata: { provider, recipient: body.recipient, subject: body.subject },
      });
      return jsonOk({
        dryRun: true,
        provider,
        wouldSend: canSendEmail(),
        recipient: body.recipient,
        subject: body.subject,
      });
    }

    if (body.confirmation !== confirmationPhrase) {
      return jsonOk({
        dryRun: false,
        sent: false,
        provider,
        requiredConfirmation: confirmationPhrase,
        reason: "Real email tests require the confirmation phrase.",
      }, 409);
    }

    const delivery = await sendResendEmail({
      recipient: body.recipient,
      subject: body.subject,
      messageBody: body.messageBody,
    });

    await writeAuditEvent({
      action: "workers.email.test.send",
      resourceType: "email_provider",
      purpose: "provider-verification",
      outcome: delivery.status === "sent" ? "success" : "error",
      metadata: { recipient: body.recipient, subject: body.subject, delivery },
    });

    return jsonOk({
      sent: delivery.status === "sent",
      provider,
      delivery,
    }, delivery.status === "sent" ? 200 : 502);
  } catch (error) {
    return jsonError(error);
  }
}

async function readJson(request: Request) {
  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

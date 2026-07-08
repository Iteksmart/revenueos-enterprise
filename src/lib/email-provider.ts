import { ConfigurationError, serverEnv } from "./config";

export type EmailDeliveryResult = {
  status: "sent" | "failed";
  error: string | null;
  metadata: Record<string, unknown>;
};

type EmailInput = {
  recipient: string;
  subject: string;
  messageBody: string;
};

export function canSendEmail() {
  return Boolean(serverEnv.RESEND_API_KEY && serverEnv.RESEND_FROM_EMAIL && serverEnv.OUTBOUND_SEND_ENABLED === "true");
}

export function getEmailProviderStatus() {
  return {
    provider: "resend",
    configured: Boolean(serverEnv.RESEND_API_KEY && serverEnv.RESEND_FROM_EMAIL),
    enabled: serverEnv.OUTBOUND_SEND_ENABLED === "true",
    senderConfigured: Boolean(serverEnv.RESEND_FROM_EMAIL),
  };
}

export async function sendResendEmail(input: EmailInput): Promise<EmailDeliveryResult> {
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

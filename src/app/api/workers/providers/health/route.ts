import { serverEnv } from "@/lib/config";
import { jsonError, jsonOk } from "@/lib/responses";
import { requireWorkerToken } from "@/lib/worker-auth";

type ProviderHealth = {
  provider: string;
  configured: boolean;
  ok: boolean;
  status?: number;
  detail?: string;
  model?: string;
};

export async function GET(request: Request) {
  try {
    requireWorkerToken(request);
    const [resend, ai] = await Promise.all([checkResend(), checkAiProvider()]);
    return jsonOk({ providers: [resend, ai] });
  } catch (error) {
    return jsonError(error);
  }
}

async function checkResend(): Promise<ProviderHealth> {
  if (!serverEnv.RESEND_API_KEY) {
    return { provider: "resend", configured: false, ok: false, detail: "RESEND_API_KEY is not configured" };
  }

  const response = await fetch("https://api.resend.com/domains", {
    headers: { authorization: `Bearer ${serverEnv.RESEND_API_KEY}` },
    cache: "no-store",
  });

  return {
    provider: "resend",
    configured: true,
    ok: response.ok,
    status: response.status,
    detail: response.ok ? "Resend API key accepted" : "Resend API key check failed",
  };
}

async function checkAiProvider(): Promise<ProviderHealth> {
  if (!serverEnv.OPENAI_API_KEY) {
    return { provider: "nemotron", configured: false, ok: false, detail: "OPENAI_API_KEY is not configured" };
  }

  const model = serverEnv.OPENAI_MODEL ?? "gpt-5.5";
  const response = await fetch(`${serverEnv.OPENAI_BASE_URL ?? "https://api.openai.com/v1"}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${serverEnv.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Reply with exactly: RevenueOS provider health ok." },
        { role: "user", content: "Run a health check." },
      ],
      temperature: 0,
      max_tokens: 16,
    }),
  });

  if (!response.ok) {
    return {
      provider: "nemotron",
      configured: true,
      ok: false,
      status: response.status,
      model,
      detail: "AI provider chat completion failed",
    };
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content?.trim();
  return {
    provider: "nemotron",
    configured: true,
    ok: Boolean(content),
    status: response.status,
    model,
    detail: content ? "AI provider returned a completion" : "AI provider returned an empty completion",
  };
}

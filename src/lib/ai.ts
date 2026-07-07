import { ConfigurationError, serverEnv } from "./config";

type Message = {
  role: "system" | "user";
  content: string;
};

export async function runRevenueAgent(messages: Message[]) {
  if (!serverEnv.OPENAI_API_KEY) {
    throw new ConfigurationError("OPENAI_API_KEY is required for AI agent execution");
  }

  const response = await fetch(`${serverEnv.OPENAI_BASE_URL ?? "https://api.openai.com/v1"}/chat/completions`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${serverEnv.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: serverEnv.OPENAI_MODEL ?? "gpt-5.5",
      messages,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI provider request failed: ${response.status}`);
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI provider returned no content");
  }

  return content;
}

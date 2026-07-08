import { z } from "zod";
import { AuthError } from "@/lib/auth";
import { serverEnv } from "@/lib/config";
import { runIntegrationSync } from "@/lib/integration-sync-runner";
import { jsonError, jsonOk } from "@/lib/responses";

const cronSyncSchema = z.object({
  providers: z.array(z.string().trim()).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export async function GET(request: Request) {
  try {
    requireCronSecret(request);
    const { searchParams } = new URL(request.url);
    const providers = searchParams.get("providers")?.split(",").map((provider) => provider.trim()).filter(Boolean);
    const limit = Number(searchParams.get("limit") ?? 50);
    const body = cronSyncSchema.parse({ providers, limit });
    const result = await runIntegrationSync(body);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}

function requireCronSecret(request: Request) {
  const configured = serverEnv.CRON_SECRET;
  if (!configured) {
    throw new AuthError("CRON_SECRET is required for scheduled integration sync", 503);
  }

  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token || token !== configured) {
    throw new AuthError("Cron bearer token is required", 401);
  }
}

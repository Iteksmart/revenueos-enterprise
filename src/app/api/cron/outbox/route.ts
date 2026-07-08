import { AuthError } from "@/lib/auth";
import { serverEnv } from "@/lib/config";
import { processOutbox } from "@/lib/outbox-worker";
import { jsonError, jsonOk } from "@/lib/responses";

export async function GET(request: Request) {
  try {
    requireCronSecret(request);
    const result = await processOutbox({ limit: 25, mode: "dry-run", trigger: "cron" });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}

function requireCronSecret(request: Request) {
  const configured = serverEnv.CRON_SECRET;
  if (!configured) {
    throw new AuthError("CRON_SECRET is required for scheduled worker execution", 503);
  }

  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token || token !== configured) {
    throw new AuthError("Cron bearer token is required", 401);
  }
}

import { z } from "zod";
import { runIntegrationSync } from "@/lib/integration-sync-runner";
import { jsonError, jsonOk } from "@/lib/responses";
import { requireWorkerToken } from "@/lib/worker-auth";

const workerSyncSchema = z.object({
  provider: z.string().trim().optional(),
  providers: z.array(z.string().trim()).optional(),
  organizationId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export async function POST(request: Request) {
  try {
    requireWorkerToken(request);
    const body = workerSyncSchema.parse(await request.json().catch(() => ({})));
    const result = await runIntegrationSync(body);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}

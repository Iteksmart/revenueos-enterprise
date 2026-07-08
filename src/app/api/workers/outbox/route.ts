import { z } from "zod";
import { AuthError } from "@/lib/auth";
import { serverEnv } from "@/lib/config";
import { processOutbox } from "@/lib/outbox-worker";
import { jsonError, jsonOk } from "@/lib/responses";

const workerRequestSchema = z.object({
  limit: z.number().int().min(1).max(50).default(10),
  mode: z.enum(["dry-run", "send"]).default("dry-run"),
});

export async function POST(request: Request) {
  try {
    requireWorkerToken(request);
    const body = workerRequestSchema.parse(await readJson(request));
    const result = await processOutbox({ limit: body.limit, mode: body.mode, trigger: "manual" });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}

function requireWorkerToken(request: Request) {
  const configured = serverEnv.REVENUEOS_WORKER_TOKEN;
  if (!configured) {
    throw new AuthError("REVENUEOS_WORKER_TOKEN is required for worker execution", 503);
  }

  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token || token !== configured) {
    throw new AuthError("Worker bearer token is required", 401);
  }
}

async function readJson(request: Request) {
  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

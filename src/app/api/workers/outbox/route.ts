import { z } from "zod";
import { processOutbox } from "@/lib/outbox-worker";
import { jsonError, jsonOk } from "@/lib/responses";
import { requireWorkerToken } from "@/lib/worker-auth";

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

async function readJson(request: Request) {
  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

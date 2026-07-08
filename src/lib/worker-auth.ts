import { AuthError } from "./auth";
import { serverEnv } from "./config";

export function requireWorkerToken(request: Request) {
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

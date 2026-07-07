import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { requireEnv } from "./config";

const claimsSchema = z.object({
  sub: z.string(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  org_id: z.string().uuid().optional(),
  permissions: z.array(z.string()).optional(),
});

export type AuthContext = {
  subject: string;
  email?: string;
  name?: string;
  organizationId?: string;
  permissions: Set<string>;
};

export async function requireAuth(request: Request, permission?: string): Promise<AuthContext> {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) {
    throw new AuthError("Bearer token is required", 401);
  }

  const jwks = createRemoteJWKSet(new URL(requireEnv("AUTH_JWKS_URL")));
  const verified = await jwtVerify(token, jwks, {
    issuer: requireEnv("AUTH_ISSUER"),
    audience: requireEnv("AUTH_AUDIENCE"),
  });
  const claims = claimsSchema.parse(verified.payload);
  const permissions = new Set(claims.permissions ?? []);

  if (permission && !permissions.has(permission) && !permissions.has("revenueos:admin")) {
    throw new AuthError(`Missing permission: ${permission}`, 403);
  }

  return {
    subject: claims.sub,
    email: claims.email,
    name: claims.name,
    organizationId: claims.org_id,
    permissions,
  };
}

export class AuthError extends Error {
  constructor(message: string, readonly status = 401) {
    super(message);
    this.name = "AuthError";
  }
}

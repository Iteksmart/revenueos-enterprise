import { createRemoteJWKSet, jwtVerify } from "jose";
import { auth as clerkAuth } from "@clerk/nextjs/server";
import { z } from "zod";
import { requireEnv, serverEnv } from "./config";

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
  const clerkContext = await tryClerkAuth(permission);
  if (clerkContext) {
    return clerkContext;
  }

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

async function tryClerkAuth(permission?: string): Promise<AuthContext | undefined> {
  if (!serverEnv.CLERK_SECRET_KEY && !serverEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return undefined;
  }

  try {
    const session = await clerkAuth();
    if (!session.userId) {
      throw new AuthError("Clerk session is required", 401);
    }

    const claims = (session.sessionClaims ?? {}) as ClerkClaims;
    const permissions = new Set([
      ...toStringArray(claims.permissions),
      ...toStringArray(claims.public_metadata?.permissions),
      ...toStringArray(claims.private_metadata?.permissions),
      ...toStringArray(claims.metadata?.permissions),
    ]);

    if (claims.org_role) {
      permissions.add(`clerk:${claims.org_role}`);
    }

    if (permission && !permissions.has(permission) && !permissions.has("revenueos:admin")) {
      throw new AuthError(`Missing permission: ${permission}`, 403);
    }

    return {
      subject: session.userId,
      email: typeof claims.email === "string" ? claims.email : undefined,
      name: typeof claims.name === "string" ? claims.name : undefined,
      organizationId: session.orgId ?? stringClaim(claims.org_id) ?? stringClaim(claims.orgId),
      permissions,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    return undefined;
  }
}

type ClerkClaims = {
  email?: unknown;
  name?: unknown;
  org_id?: unknown;
  orgId?: unknown;
  org_role?: unknown;
  permissions?: unknown;
  public_metadata?: { permissions?: unknown };
  private_metadata?: { permissions?: unknown };
  metadata?: { permissions?: unknown };
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function stringClaim(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export class AuthError extends Error {
  constructor(message: string, readonly status = 401) {
    super(message);
    this.name = "AuthError";
  }
}

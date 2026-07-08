import { createRemoteJWKSet, jwtVerify } from "jose";
import { auth as clerkAuth } from "@clerk/nextjs/server";
import { z } from "zod";
import { requireEnv, serverEnv } from "./config";
import { sql } from "./db";

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
  revenueOSUserId?: string;
};

export async function requireAuth(request: Request, permission?: string): Promise<AuthContext> {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    const clerkContext = await tryClerkAuth(permission);
    if (clerkContext) {
      return clerkContext;
    }

    throw new AuthError("Clerk session or bearer token is required", 401);
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

    const membership = await findRevenueOSMembership(session.userId);
    for (const dbPermission of membership?.permissions ?? []) {
      permissions.add(dbPermission);
    }

    const organizationId = session.orgId ?? stringClaim(claims.org_id) ?? stringClaim(claims.orgId) ?? membership?.organizationId;

    if (permission && !permissions.has(permission) && !permissions.has("revenueos:admin")) {
      throw new AuthError(`Missing permission: ${permission}`, 403);
    }

    return {
      subject: session.userId,
      email: typeof claims.email === "string" ? claims.email : undefined,
      name: typeof claims.name === "string" ? claims.name : undefined,
      organizationId,
      permissions,
      revenueOSUserId: membership?.userId,
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

async function findRevenueOSMembership(subject: string) {
  const rows = await sql()`
    select
      u.id as user_id,
      u.organization_id,
      coalesce(array_agg(distinct permission) filter (where permission is not null), '{}') as permissions
    from revenueos_users u
    left join revenueos_user_roles ur on ur.user_id = u.id
    left join revenueos_roles r on r.id = ur.role_id
    left join lateral unnest(r.permissions) as permission on true
    where u.external_subject = ${subject}
    group by u.id, u.organization_id
    order by u.created_at asc
    limit 1
  `;

  const row = rows[0];
  if (!row) {
    return undefined;
  }

  return {
    userId: String(row.user_id),
    organizationId: String(row.organization_id),
    permissions: Array.isArray(row.permissions)
      ? row.permissions.filter((permission): permission is string => typeof permission === "string")
      : [],
  };
}

export class AuthError extends Error {
  constructor(message: string, readonly status = 401) {
    super(message);
    this.name = "AuthError";
  }
}

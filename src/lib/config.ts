import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  AUTH_JWKS_URL: z.string().url().optional(),
  AUTH_ISSUER: z.string().optional(),
  AUTH_AUDIENCE: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_MODEL: z.string().optional(),
  REVENUEOS_WORKER_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().optional(),
});

export const serverEnv = serverEnvSchema.parse(process.env);

export function requireEnv(name: keyof typeof serverEnv): string {
  const value = serverEnv[name];
  if (!value) {
    throw new ConfigurationError(`${name} is required for this capability`);
  }
  return value;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

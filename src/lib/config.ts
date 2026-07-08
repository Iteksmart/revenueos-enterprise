import { z } from "zod";

const trimmedString = z.preprocess(
  (value) => typeof value === "string" ? value.trim() : value,
  z.string().optional(),
);

const trimmedUrl = z.preprocess(
  (value) => typeof value === "string" ? value.trim() : value,
  z.string().url().optional(),
);

const serverEnvSchema = z.object({
  DATABASE_URL: trimmedUrl,
  AUTH_JWKS_URL: trimmedUrl,
  AUTH_ISSUER: trimmedString,
  AUTH_AUDIENCE: trimmedString,
  CLERK_SECRET_KEY: trimmedString,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: trimmedString,
  OPENAI_API_KEY: trimmedString,
  OPENAI_BASE_URL: trimmedUrl,
  OPENAI_MODEL: trimmedString,
  RESEND_API_KEY: trimmedString,
  RESEND_FROM_EMAIL: trimmedString,
  OUTBOUND_SEND_ENABLED: z.preprocess(
    (value) => typeof value === "string" ? value.trim().toLowerCase() : value,
    z.enum(["true", "false"]).optional(),
  ),
  REVENUEOS_WORKER_TOKEN: trimmedString,
  CRON_SECRET: trimmedString,
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

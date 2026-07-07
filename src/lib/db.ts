import postgres from "postgres";
import { ConfigurationError, requireEnv } from "./config";

let client: postgres.Sql | undefined;

export function sql(): postgres.Sql {
  if (!client) {
    client = postgres(requireEnv("DATABASE_URL"), {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return client;
}

export async function assertDatabaseReady() {
  try {
    const rows = await sql()`select now() as now`;
    return rows[0];
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }
    throw new Error(`Database health check failed: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

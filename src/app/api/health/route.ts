import { assertDatabaseReady } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/responses";

export async function GET() {
  try {
    const database = await assertDatabaseReady();
    return jsonOk({ status: "ready", database });
  } catch (error) {
    return jsonError(error);
  }
}

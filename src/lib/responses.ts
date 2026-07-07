import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ConfigurationError } from "./config";
import { AuthError } from "./auth";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function jsonError(error: unknown) {
  if (error instanceof ConfigurationError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  }

  if (error instanceof ZodError) {
    return NextResponse.json({ ok: false, error: "Validation failed", issues: error.issues }, { status: 400 });
  }

  if (error instanceof AuthError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Unexpected server error";
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}

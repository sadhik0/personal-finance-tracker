import { NextResponse } from "next/server";
import { getCurrentUser } from "@/backend/services/auth.service";
import type { UserDoc } from "@/backend/models/User";
import { InputError } from "@/backend/utils/validate";

/**
 * Wrap an API route handler so it:
 *  1. Makes sure the visitor is logged in (via their session cookie).
 *  2. Catches any error thrown inside `fn` and turns it into a clean
 *     JSON error response, so one route can't crash the whole server.
 */
export async function withUser(
  fn: (user: UserDoc) => Promise<NextResponse> | NextResponse,
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return await fn(user);
  } catch (e) {
    // Our own validation messages are safe to show. Anything else (database
    // errors, bugs) is logged on the server and hidden from the client.
    if (e instanceof InputError) return NextResponse.json({ error: e.message }, { status: 400 });
    const name = e instanceof Error ? e.name : "";
    if (name === "CastError" || name === "ValidationError")
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export const ok = (data: unknown) => NextResponse.json(data);
export const bad = (msg: string, status = 400) =>
  NextResponse.json({ error: msg }, { status });

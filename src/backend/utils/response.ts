import { NextResponse } from "next/server";
import { getCurrentUser } from "@/backend/services/auth.service";
import type { UserDoc } from "@/backend/models/User";

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
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 400 },
    );
  }
}

export const ok = (data: unknown) => NextResponse.json(data);
export const bad = (msg: string, status = 400) =>
  NextResponse.json({ error: msg }, { status });

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/backend/services/auth.service";
import type { UserDoc } from "@/backend/models/User";
import { InputError } from "@/backend/utils/validate";
import { requireSameOrigin, isMutating } from "@/backend/utils/sameOrigin";
import { allow, clientIp } from "@/backend/services/rateLimit.service";

/** Moderate per-route limits (per minute), keyed by user + IP + route. */
const API_LIMIT_READ = 120;
const API_LIMIT_WRITE = 60;

/**
 * Wrap an API route handler so it:
 *  1. Blocks cross-site state-changing requests (exact Origin check).
 *  2. Makes sure the visitor is logged in (via their session cookie).
 *  3. Applies a moderate per-route rate limit.
 *  4. Catches any error thrown inside `fn` and turns it into a clean
 *     JSON error response, so one route can't crash the whole server.
 */
export async function withUser(
  req: Request,
  fn: (user: UserDoc) => Promise<NextResponse> | NextResponse,
) {
  const blocked = requireSameOrigin(req);
  if (blocked) return blocked;
  const t0 = Date.now();
  const user = await getCurrentUser();
  const tAuth = Date.now();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // /api/rules/<id>/confirm and /api/rules/<id2>/confirm share one bucket
    const route = new URL(req.url).pathname.replace(/[a-f0-9]{24}/gi, ":id");
    const write = isMutating(req);
    const key = `api:${write ? "w" : "r"}:${route}:${user.id}:${clientIp(req)}`;
    if (!(await allow(key, write ? API_LIMIT_WRITE : API_LIMIT_READ, 60)))
      return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    const tRate = Date.now();
    const res = await fn(user);
    const tEnd = Date.now();
    // Shows up in the browser's Network tab > Timing. Tells us where the time
    // goes (auth lookup, rate-limit check, or the route's own work) before we optimise anything.
    res.headers.set(
      "Server-Timing",
      `auth;dur=${tAuth - t0}, ratelimit;dur=${tRate - tAuth}, handler;dur=${tEnd - tRate}, total;dur=${tEnd - t0}`,
    );
    return res;
  } catch (e) {
    // Our own validation messages are safe to show. Anything else (database
    // errors, bugs) is logged on the server and hidden from the client.
    if (e instanceof InputError) return NextResponse.json({ error: e.message }, { status: e.status });
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

import { connectToDatabase } from "@/backend/db/connect";
import { RateLimit } from "@/backend/models/RateLimit";
import { NextResponse } from "next/server";

export function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown").slice(0, 64);
}

/**
 * Counts one attempt against `key`. Returns true while under `max` attempts
 * inside the current `windowSec` window, false once the limit is exceeded.
 * Stored in MongoDB so it works across Vercel's serverless instances.
 */
export async function allow(key: string, max: number, windowSec: number): Promise<boolean> {
  await connectToDatabase();
  const now = new Date();
  const hit = await RateLimit.findOneAndUpdate(
    { key, resetAt: { $gt: now } },
    { $inc: { count: 1 } },
    { new: true },
  );
  if (hit) return hit.count <= max;
  // no live window: clear any expired leftover, then start a fresh one
  await RateLimit.deleteOne({ key, resetAt: { $lte: now } });
  try {
    await RateLimit.create({ key, count: 1, resetAt: new Date(now.getTime() + windowSec * 1000) });
    return true;
  } catch {
    // another request created the window at the same moment — count into it
    const again = await RateLimit.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true });
    return again ? again.count <= max : true;
  }
}

export const tooMany = () =>
  NextResponse.json({ error: "Too many attempts. Please wait a few minutes and try again." }, { status: 429 });

import { connectToDatabase } from "@/backend/db/connect";
import { User } from "@/backend/models";
import { MIN_PASSWORD, createSession, hashPassword } from "@/backend/services/auth.service";
import { createHash, timingSafeEqual } from "crypto";
import { bad, ok } from "@/backend/utils/response";
import { allow, clientIp, tooMany } from "@/backend/services/rateLimit.service";

function sameSecret(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
import { seedDefaults } from "@/backend/services/seed.service";

export async function POST(req: Request) {
  await connectToDatabase();
  const body = await req.json().catch(() => ({}));
  // Counted before the code is checked, so guessing the code is throttled too.
  if (!(await allow(`register:${clientIp(req)}`, 5, 3600))) return tooMany();
  const inviteCode = process.env.REGISTRATION_CODE;
  if (!inviteCode) return bad("Registration is closed", 403);
  if (!sameSecret(String(body.inviteCode ?? ""), inviteCode)) return bad("Invalid invite code", 403);
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const displayName = (String(body.displayName ?? username).trim() || username).slice(0, 60);
  if (username.length < 3) return bad("Username must be at least 3 characters");
  if (username.length > 32) return bad("Username must be at most 32 characters");
  if (password.length > 200) return bad("Password is too long");
  if (password.length < MIN_PASSWORD) return bad(`Password must be at least ${MIN_PASSWORD} characters`);

  const existing = await User.findOne({ username });
  if (existing) return bad("Username already taken");

  const user = await User.create({ username, displayName, passwordHash: hashPassword(password) });

  await seedDefaults(user.id);
  await createSession(user.id, req.headers.get("user-agent") ?? "");
  return ok({ id: user.id, username: user.username, displayName: user.displayName });
}

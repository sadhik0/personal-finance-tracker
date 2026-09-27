import { connectToDatabase } from "@/backend/db/connect";
import { User } from "@/backend/models";
import { createSession, hashPassword } from "@/backend/services/auth.service";
import { bad, ok } from "@/backend/utils/response";
import { seedDefaults } from "@/backend/services/seed.service";

export async function POST(req: Request) {
  await connectToDatabase();
  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const displayName = String(body.displayName ?? username).trim() || username;
  if (username.length < 3) return bad("Username must be at least 3 characters");
  if (password.length < 6) return bad("Password must be at least 6 characters");

  const existing = await User.findOne({ username });
  if (existing) return bad("Username already taken");

  const user = await User.create({ username, displayName, passwordHash: hashPassword(password) });

  await seedDefaults(user.id);
  await createSession(user.id, req.headers.get("user-agent") ?? "");
  return ok({ id: user.id, username: user.username, displayName: user.displayName });
}

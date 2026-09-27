import { connectToDatabase } from "@/backend/db/connect";
import { User } from "@/backend/models";
import { createSession, verifyPassword } from "@/backend/services/auth.service";
import { bad, ok } from "@/backend/utils/response";

export async function POST(req: Request) {
  await connectToDatabase();
  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const user = await User.findOne({ username });
  if (!user || !verifyPassword(password, user.passwordHash))
    return bad("Invalid username or password", 401);
  await createSession(user.id, req.headers.get("user-agent") ?? "");
  return ok({ id: user.id, username: user.username, displayName: user.displayName });
}

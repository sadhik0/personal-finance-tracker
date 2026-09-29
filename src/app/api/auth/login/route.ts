import { requireSameOrigin } from "@/backend/utils/sameOrigin";
import { connectToDatabase } from "@/backend/db/connect";
import { User } from "@/backend/models";
import { createSession, hashPassword, verifyPassword } from "@/backend/services/auth.service";

// Checked against when the username does not exist, so an unknown username
// takes about as long to reject as a wrong password (no user-guessing by timing).
let dummyHash: string | null = null;
import { readJsonOrEmpty } from "@/backend/utils/validate";
import { bad, ok } from "@/backend/utils/response";
import { allow, clientIp, tooMany } from "@/backend/services/rateLimit.service";

export async function POST(req: Request) {
  const blocked = requireSameOrigin(req);
  if (blocked) return blocked;
  await connectToDatabase();
  const body = await readJsonOrEmpty(req);
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const ip = clientIp(req);
  if (
    !(await allow(`login:${ip}:${username.slice(0, 64)}`, 5, 900)) ||
    !(await allow(`login-ip:${ip}`, 30, 900))
  )
    return tooMany();
  if (password.length > 200) return bad("Invalid username or password", 401);
  const user = await User.findOne({ username });
  if (!user) {
    dummyHash ??= hashPassword("not-a-real-password");
    verifyPassword(password, dummyHash);
    return bad("Invalid username or password", 401);
  }
  if (!verifyPassword(password, user.passwordHash)) return bad("Invalid username or password", 401);
  await createSession(user.id, req.headers.get("user-agent") ?? "");
  return ok({ id: user.id, username: user.username, displayName: user.displayName });
}

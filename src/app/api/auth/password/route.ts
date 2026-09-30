import { cookies } from "next/headers";
import { connectToDatabase } from "@/backend/db/connect";
import { Session, User } from "@/backend/models";
import { bad, ok, withUser } from "@/backend/utils/response";
import { MIN_PASSWORD, SESSION_COOKIE, hashPassword, verifyPassword } from "@/backend/services/auth.service";
import { allow, tooMany } from "@/backend/services/rateLimit.service";
import { readJson } from "@/backend/utils/validate";

export async function POST(req: Request) {
  return withUser(req, async (user) => {
    await connectToDatabase();
    const b = await readJson(req);
    if (!(await allow(`pwd:${user.id}`, 5, 900))) return tooMany();
    if (!verifyPassword(String(b.current ?? "").slice(0, 200), user.passwordHash))
      return bad("Current password is incorrect", 401);
    const next = String(b.next ?? "");
    if (next.length < MIN_PASSWORD) return bad(`New password must be at least ${MIN_PASSWORD} characters`);
    if (next.length > 200) return bad("New password is too long");
    await User.updateOne({ _id: user.id }, { $set: { passwordHash: hashPassword(next) } });
    // Sign out every OTHER device, so a stolen or forgotten session stops
    // working the moment the password changes. This device stays logged in.
    const currentId = (await cookies()).get(SESSION_COOKIE)?.value;
    await Session.deleteMany({ userId: user.id, ...(currentId ? { _id: { $ne: currentId } } : {}) });
    return ok({ ok: true });
  });
}

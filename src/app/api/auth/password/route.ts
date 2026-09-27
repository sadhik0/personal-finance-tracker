import { connectToDatabase } from "@/backend/db/connect";
import { Session, User } from "@/backend/models";
import { bad, ok, withUser } from "@/backend/utils/response";
import { hashPassword, verifyPassword } from "@/backend/services/auth.service";

export async function POST(req: Request) {
  return withUser(async (user) => {
    await connectToDatabase();
    const b = await req.json();
    if (!verifyPassword(String(b.current ?? ""), user.passwordHash))
      return bad("Current password is incorrect", 401);
    if (String(b.next ?? "").length < 6) return bad("New password must be at least 6 characters");
    await User.updateOne({ _id: user.id }, { $set: { passwordHash: hashPassword(String(b.next)) } });
    if (b.logoutAll) await Session.deleteMany({ userId: user.id });
    return ok({ ok: true });
  });
}

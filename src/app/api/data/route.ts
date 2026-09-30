import { connectToDatabase } from "@/backend/db/connect";
import { Transaction } from "@/backend/models";
import { bad, ok, withUser } from "@/backend/utils/response";
import { verifyPassword } from "@/backend/services/auth.service";
import { allow, tooMany } from "@/backend/services/rateLimit.service";
import { readJsonOrEmpty } from "@/backend/utils/validate";

/** Clears all transactions for the signed-in user (accounts/categories kept). Needs the password. */
export async function DELETE(req: Request) {
  return withUser(req, async (user) => {
    await connectToDatabase();
    // Wiping every transaction needs the password again (a stolen open session is not enough).
    if (!(await allow(`wipe:${user.id}`, 5, 900))) return tooMany();
    const b = await readJsonOrEmpty(req);
    if (!verifyPassword(String(b.password ?? "").slice(0, 200), user.passwordHash))
      return bad("Password is incorrect", 401);
    await Transaction.deleteMany({ userId: user.id });
    return ok({ ok: true });
  });
}

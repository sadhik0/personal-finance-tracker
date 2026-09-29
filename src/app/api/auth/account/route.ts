import { connectToDatabase } from "@/backend/db/connect";
import { Account, Category, ExpectedRule, Session, Settings, Transaction, User } from "@/backend/models";
import { readJsonOrEmpty } from "@/backend/utils/validate";
import { bad, ok, withUser } from "@/backend/utils/response";
import { destroySession, verifyPassword } from "@/backend/services/auth.service";
import { allow, tooMany } from "@/backend/services/rateLimit.service";

/**
 * Permanently deletes the logged-in user's account and EVERYTHING stored for
 * it in MongoDB (real deletes, not soft deletes). Requires the password.
 * The User row is removed last, so if anything fails half-way the account
 * still exists and the request can simply be retried.
 */
export async function DELETE(req: Request) {
  return withUser(req, async (user) => {
    await connectToDatabase();
    if (!(await allow(`delacct:${user.id}`, 5, 900))) return tooMany();
    const b = await readJsonOrEmpty(req);
    if (!verifyPassword(String(b.password ?? ""), user.passwordHash))
      return bad("Password is incorrect", 401);

    await Transaction.deleteMany({ userId: user.id });
    await ExpectedRule.deleteMany({ userId: user.id });
    await Category.deleteMany({ userId: user.id });
    await Account.deleteMany({ userId: user.id });
    await Settings.deleteMany({ userId: user.id });
    await Session.deleteMany({ userId: user.id });
    await User.deleteOne({ _id: user.id });
    await destroySession(); // clears the cookie in this browser
    return ok({ ok: true });
  });
}

import { connectToDatabase } from "@/backend/db/connect";
import { Transaction } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";

/** Clears all transactions for the signed-in user (accounts/categories kept). */
export async function DELETE(req: Request) {
  return withUser(req, async (user) => {
    await connectToDatabase();
    await Transaction.deleteMany({ userId: user.id });
    return ok({ ok: true });
  });
}

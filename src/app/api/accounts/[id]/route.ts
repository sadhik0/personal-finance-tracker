import { connectToDatabase } from "@/backend/db/connect";
import { Account, Transaction } from "@/backend/models";
import { ok, bad, withUser } from "@/backend/utils/response";
import { bool, num, oneOf, paramId, readJson, text } from "@/backend/utils/validate";
type Ctx = { params: Promise<{ id: string }> };
const KINDS = ["bank", "cash", "investment", "pf", "loan"] as const;
export async function PUT(req: Request, ctx: Ctx) {
  return withUser(req, async (user) => {
    await connectToDatabase();
    const id = paramId((await ctx.params).id);
    const b = await readJson(req);
    const current = await Account.findOne({ _id: id, userId: user.id });
    if (!current) return ok(null);
    const patch: Record<string, unknown> = {};
    if (b.name !== undefined) patch.name = text(b.name, "Name", { max: 100, min: 1 });
    if (b.kind !== undefined) {
      const kind = oneOf(b.kind, "Kind", KINDS);
      if (kind !== current.kind) {
        const hasTransactions = await Transaction.exists({ userId: user.id, $or: [{ accountId: id }, { toAccountId: id }] });
        if (hasTransactions) return bad("This account type cannot be changed because it already has transactions. Create a new account instead.", 409);
      }
      patch.kind = kind;
    }
    if (b.openingBalance !== undefined) patch.openingBalance = num(b.openingBalance, "Opening balance");
    if (b.archived !== undefined) patch.archived = bool(b.archived, "archived");
    const row = await Account.findOneAndUpdate({ _id: id, userId: user.id }, { $set: patch }, { new: true });
    return ok(row ?? null);
  });
}
export async function DELETE(req: Request, ctx: Ctx) {
  return withUser(req, async (user) => {
    await connectToDatabase();
    const id = paramId((await ctx.params).id);
    const hasTransactions = await Transaction.exists({ userId: user.id, $or: [{ accountId: id }, { toAccountId: id }] });
    if (hasTransactions) {
      const row = await Account.findOneAndUpdate({ _id: id, userId: user.id }, { $set: { archived: true } }, { new: true });
      return ok({ ok: true, archived: true, account: row, message: "This account has transaction history, so it was archived instead of deleted." });
    }
    await Account.deleteOne({ _id: id, userId: user.id });
    return ok({ ok: true, archived: false });
  });
}

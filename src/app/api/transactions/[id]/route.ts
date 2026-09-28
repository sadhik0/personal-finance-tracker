import { connectToDatabase } from "@/backend/db/connect";
import { Account, Category, Transaction } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";
import { TX_TYPES } from "@/backend/services/finance.service";
import { idOrNull, isoDate, metaOrNull, oneOf, paramId, positive, readJson, text } from "@/backend/utils/validate";
import { ownedOrNull } from "@/backend/utils/ownership";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  return withUser(async (user) => {
    await connectToDatabase();
    const id = paramId((await ctx.params).id);
    const b = await readJson(req);
    const patch: Record<string, unknown> = {};
    if (b.type !== undefined) patch.type = oneOf(b.type, "type", TX_TYPES);
    if (b.amount !== undefined) patch.amount = positive(b.amount, "Amount");
    if (b.date !== undefined) patch.date = isoDate(b.date, "Date");
    if (b.categoryId !== undefined)
      patch.categoryId = await ownedOrNull(Category, user.id, idOrNull(b.categoryId, "categoryId"));
    if (b.accountId !== undefined)
      patch.accountId = await ownedOrNull(Account, user.id, idOrNull(b.accountId, "accountId"));
    if (b.toAccountId !== undefined)
      patch.toAccountId = await ownedOrNull(Account, user.id, idOrNull(b.toAccountId, "toAccountId"));
    if (b.description !== undefined) patch.description = text(b.description, "Description", { max: 500, clip: true });
    if (b.meta !== undefined) patch.meta = metaOrNull(b.meta);
    patch.updatedAt = new Date();
    const row = await Transaction.findOneAndUpdate(
      { _id: id, userId: user.id },
      { $set: patch },
      { new: true },
    );
    return ok(row ?? null);
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return withUser(async (user) => {
    await connectToDatabase();
    const id = paramId((await ctx.params).id);
    await Transaction.updateOne(
      { _id: id, userId: user.id },
      { $set: { deletedAt: new Date(), updatedAt: new Date() } },
    );
    return ok({ ok: true });
  });
}

import { connectToDatabase } from "@/backend/db/connect";
import { Transaction } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  return withUser(async (user) => {
    await connectToDatabase();
    const { id } = await ctx.params;
    const b = await req.json();
    const patch: Record<string, unknown> = {};
    if (b.type !== undefined) patch.type = String(b.type);
    if (b.amount !== undefined) patch.amount = Number(b.amount);
    if (b.date !== undefined) patch.date = String(b.date);
    if (b.categoryId !== undefined) patch.categoryId = b.categoryId ? b.categoryId : null;
    if (b.accountId !== undefined) patch.accountId = b.accountId ? b.accountId : null;
    if (b.toAccountId !== undefined) patch.toAccountId = b.toAccountId ? b.toAccountId : null;
    if (b.description !== undefined) patch.description = String(b.description);
    if (b.meta !== undefined) patch.meta = b.meta;
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
    const { id } = await ctx.params;
    await Transaction.updateOne(
      { _id: id, userId: user.id },
      { $set: { deletedAt: new Date(), updatedAt: new Date() } },
    );
    return ok({ ok: true });
  });
}

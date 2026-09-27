import { connectToDatabase } from "@/backend/db/connect";
import { Account } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  return withUser(async (user) => {
    await connectToDatabase();
    const { id } = await ctx.params;
    const b = await req.json();
    const patch: Record<string, unknown> = {};
    if (b.name !== undefined) patch.name = String(b.name);
    if (b.kind !== undefined) patch.kind = String(b.kind);
    if (b.openingBalance !== undefined) patch.openingBalance = Number(b.openingBalance);
    if (b.archived !== undefined) patch.archived = Boolean(b.archived);
    const row = await Account.findOneAndUpdate(
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
    await Account.deleteOne({ _id: id, userId: user.id });
    return ok({ ok: true });
  });
}

import { connectToDatabase } from "@/backend/db/connect";
import { ExpectedRule } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  return withUser(async (user) => {
    await connectToDatabase();
    const { id } = await ctx.params;
    const b = await req.json();
    const patch: Record<string, unknown> = {};
    if (b.label !== undefined) patch.label = String(b.label);
    if (b.amount !== undefined)
      patch.amount = b.amount === null || b.amount === "" ? null : Number(b.amount);
    if (b.dayOfMonth !== undefined) patch.dayOfMonth = Number(b.dayOfMonth);
    if (b.accountId !== undefined) patch.accountId = b.accountId ? b.accountId : null;
    if (b.active !== undefined) patch.active = Boolean(b.active);
    if (b.lastHandledPeriod !== undefined)
      patch.lastHandledPeriod = b.lastHandledPeriod ? String(b.lastHandledPeriod) : null;
    const row = await ExpectedRule.findOneAndUpdate(
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
    await ExpectedRule.deleteOne({ _id: id, userId: user.id });
    return ok({ ok: true });
  });
}

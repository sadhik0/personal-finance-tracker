import { connectToDatabase } from "@/backend/db/connect";
import { Account, ExpectedRule } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";
import { bool, idOrNull, num, paramId, period, readJson, text } from "@/backend/utils/validate";
import { mustOwn } from "@/backend/utils/ownership";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  return withUser(req, async (user) => {
    await connectToDatabase();
    const id = paramId((await ctx.params).id);
    const b = await readJson(req);
    const patch: Record<string, unknown> = {};
    if (b.label !== undefined) patch.label = text(b.label, "Label", { max: 100 });
    if (b.amount !== undefined)
      patch.amount = b.amount === null || b.amount === "" ? null : num(b.amount, "Amount", { min: 0 });
    if (b.ratePct !== undefined)
      patch.ratePct = b.ratePct === null || b.ratePct === "" ? null : num(b.ratePct, "Rate", { min: 0, max: 1000 });
    if (b.dayOfMonth !== undefined)
      patch.dayOfMonth = Math.round(num(b.dayOfMonth, "Day of month", { min: 1, max: 31 }));
    if (b.accountId !== undefined)
      patch.accountId = await mustOwn(Account, user.id, idOrNull(b.accountId, "accountId"), "Account");
    if (b.active !== undefined) patch.active = bool(b.active, "active");
    if (b.lastHandledPeriod !== undefined)
      patch.lastHandledPeriod = b.lastHandledPeriod ? period(b.lastHandledPeriod, "lastHandledPeriod") : null;
    const row = await ExpectedRule.findOneAndUpdate(
      { _id: id, userId: user.id },
      { $set: patch },
      { new: true },
    );
    return ok(row ?? null);
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  return withUser(req, async (user) => {
    await connectToDatabase();
    const id = paramId((await ctx.params).id);
    await ExpectedRule.deleteOne({ _id: id, userId: user.id });
    return ok({ ok: true });
  });
}
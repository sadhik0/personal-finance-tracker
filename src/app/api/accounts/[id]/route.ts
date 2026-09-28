import { connectToDatabase } from "@/backend/db/connect";
import { Account } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";
import { bool, num, oneOf, paramId, readJson, text } from "@/backend/utils/validate";

type Ctx = { params: Promise<{ id: string }> };
const KINDS = ["bank", "cash", "investment", "pf", "loan"] as const;

export async function PUT(req: Request, ctx: Ctx) {
  return withUser(async (user) => {
    await connectToDatabase();
    const id = paramId((await ctx.params).id);
    const b = await readJson(req);
    const patch: Record<string, unknown> = {};
    if (b.name !== undefined) patch.name = text(b.name, "Name", { max: 100, min: 1 });
    if (b.kind !== undefined) patch.kind = oneOf(b.kind, "Kind", KINDS);
    if (b.openingBalance !== undefined) patch.openingBalance = num(b.openingBalance, "Opening balance");
    if (b.archived !== undefined) patch.archived = bool(b.archived, "archived");
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
    const id = paramId((await ctx.params).id);
    await Account.deleteOne({ _id: id, userId: user.id });
    return ok({ ok: true });
  });
}

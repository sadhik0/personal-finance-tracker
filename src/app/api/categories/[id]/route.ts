import { connectToDatabase } from "@/backend/db/connect";
import { Category } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  return withUser(async (user) => {
    await connectToDatabase();
    const { id } = await ctx.params;
    const b = await req.json();
    const patch: Record<string, unknown> = {};
    if (b.name !== undefined) patch.name = String(b.name);
    if (b.bucket !== undefined) patch.bucket = String(b.bucket);
    if (b.disabled !== undefined) patch.disabled = Boolean(b.disabled);
    if (b.limitMode !== undefined) patch.limitMode = b.limitMode ? String(b.limitMode) : null;
    if (b.limitValue !== undefined)
      patch.limitValue = b.limitValue === null || b.limitValue === "" ? null : Number(b.limitValue);
    const row = await Category.findOneAndUpdate(
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
    await Category.deleteOne({ _id: id, userId: user.id });
    await Category.deleteMany({ parentId: id, userId: user.id });
    return ok({ ok: true });
  });
}

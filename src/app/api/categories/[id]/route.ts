import { connectToDatabase } from "@/backend/db/connect";
import { Category } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";
import { bool, num, oneOf, paramId, readJson, text } from "@/backend/utils/validate";

type Ctx = { params: Promise<{ id: string }> };
const BUCKETS = ["needs", "wants", "savings", "none"] as const;
const LIMIT_MODES = ["fixed", "percent"] as const;

export async function PUT(req: Request, ctx: Ctx) {
  return withUser(async (user) => {
    await connectToDatabase();
    const id = paramId((await ctx.params).id);
    const b = await readJson(req);
    const patch: Record<string, unknown> = {};
    if (b.name !== undefined) patch.name = text(b.name, "Name", { max: 100, min: 1 });
    if (b.bucket !== undefined) patch.bucket = oneOf(b.bucket, "Bucket", BUCKETS);
    if (b.disabled !== undefined) patch.disabled = bool(b.disabled, "disabled");
    if (b.limitMode !== undefined)
      patch.limitMode = b.limitMode ? oneOf(b.limitMode, "limitMode", LIMIT_MODES) : null;
    if (b.limitValue !== undefined)
      patch.limitValue = b.limitValue === null || b.limitValue === "" ? null : num(b.limitValue, "limitValue", { min: 0 });
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
    const id = paramId((await ctx.params).id);
    await Category.deleteOne({ _id: id, userId: user.id });
    await Category.deleteMany({ parentId: id, userId: user.id });
    return ok({ ok: true });
  });
}

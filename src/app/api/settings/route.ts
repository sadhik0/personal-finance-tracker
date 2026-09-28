import { connectToDatabase } from "@/backend/db/connect";
import { Settings } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";
import { num, oneOf, readJson, text } from "@/backend/utils/validate";

export async function GET() {
  return withUser(async (user) => {
    await connectToDatabase();
    let row = await Settings.findOne({ userId: user.id });
    if (!row) row = await Settings.create({ userId: user.id });
    return ok(row);
  });
}

export async function PUT(req: Request) {
  return withUser(async (user) => {
    await connectToDatabase();
    const b = await readJson(req);
    const patch: Record<string, unknown> = {};
    for (const key of [
      "needsPct",
      "wantsPct",
      "savingsPct",
      "customNeedsPct",
      "customWantsPct",
      "customSavingsPct",
    ] as const) {
      if (b[key] !== undefined)
        patch[key] = b[key] === null || b[key] === "" ? null : num(b[key], key, { min: 0, max: 100 });
    }
    if (b.theme !== undefined) patch.theme = oneOf(b.theme, "theme", ["dark", "light"] as const);
    if (b.currency !== undefined) patch.currency = text(b.currency, "currency", { max: 8, min: 1 });
    const row = await Settings.findOneAndUpdate(
      { userId: user.id },
      { $set: patch, $setOnInsert: { userId: user.id } },
      { new: true, upsert: true },
    );
    return ok(row);
  });
}

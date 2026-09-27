import { connectToDatabase } from "@/backend/db/connect";
import { Settings } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";

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
    const b = await req.json();
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
        patch[key] = b[key] === null || b[key] === "" ? null : Number(b[key]);
    }
    if (b.theme !== undefined) patch.theme = String(b.theme);
    if (b.currency !== undefined) patch.currency = String(b.currency);
    const row = await Settings.findOneAndUpdate(
      { userId: user.id },
      { $set: patch, $setOnInsert: { userId: user.id } },
      { new: true, upsert: true },
    );
    return ok(row);
  });
}

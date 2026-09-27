import { connectToDatabase } from "@/backend/db/connect";
import { Category } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";

export async function GET() {
  return withUser(async (user) => {
    await connectToDatabase();
    const rows = await Category.find({ userId: user.id }).sort({ sortOrder: 1, _id: 1 });
    return ok(rows);
  });
}

export async function POST(req: Request) {
  return withUser(async (user) => {
    await connectToDatabase();
    const b = await req.json();
    const row = await Category.create({
      userId: user.id,
      name: String(b.name ?? "Category"),
      parentId: b.parentId ? b.parentId : null,
      bucket: String(b.bucket ?? "needs"),
      type: String(b.type ?? "expense"),
    });
    return ok(row);
  });
}

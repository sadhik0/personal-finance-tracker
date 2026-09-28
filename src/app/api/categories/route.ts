import { connectToDatabase } from "@/backend/db/connect";
import { Category } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";
import { idOrNull, oneOf, readJson, text } from "@/backend/utils/validate";
import { mustOwn } from "@/backend/utils/ownership";

const BUCKETS = ["needs", "wants", "savings", "none"] as const;
const CATEGORY_TYPES = ["expense", "income"] as const;

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
    const b = await readJson(req);
    const parentId = await mustOwn(Category, user.id, idOrNull(b.parentId, "parentId"), "Parent category");
    const row = await Category.create({
      userId: user.id,
      name: text(b.name, "Name", { max: 100, min: 1, fallback: "Category" }),
      parentId,
      bucket: oneOf(b.bucket, "Bucket", BUCKETS, "needs"),
      type: oneOf(b.type, "Type", CATEGORY_TYPES, "expense"),
    });
    return ok(row);
  });
}

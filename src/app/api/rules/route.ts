import { connectToDatabase } from "@/backend/db/connect";
import { ExpectedRule } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";

export async function GET() {
  return withUser(async (user) => {
    await connectToDatabase();
    const rows = await ExpectedRule.find({ userId: user.id }).sort({ _id: 1 });
    return ok(rows);
  });
}

export async function POST(req: Request) {
  return withUser(async (user) => {
    await connectToDatabase();
    const b = await req.json();
    const row = await ExpectedRule.create({
      userId: user.id,
      kind: String(b.kind ?? "salary"),
      label: String(b.label ?? ""),
      amount: b.amount ? Number(b.amount) : null,
      dayOfMonth: Number(b.dayOfMonth ?? 30),
      accountId: b.accountId ? b.accountId : null,
      active: b.active ?? true,
    });
    return ok(row);
  });
}

import { connectToDatabase } from "@/backend/db/connect";
import { Transaction } from "@/backend/models";
import { bad, ok, withUser } from "@/backend/utils/response";
import { TX_TYPES } from "@/backend/services/finance.service";

export async function GET(req: Request) {
  return withUser(async (user) => {
    await connectToDatabase();
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const type = url.searchParams.get("type");
    const categoryId = url.searchParams.get("categoryId");
    const accountId = url.searchParams.get("accountId");
    const q = url.searchParams.get("q");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 500), 2000);

    const filter: Record<string, unknown> = { userId: user.id };
    if (from || to) {
      filter.date = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {}),
      };
    }
    if (type) filter.type = type;
    if (categoryId) filter.categoryId = categoryId;
    if (accountId) filter.accountId = accountId;
    if (q) filter.description = { $regex: q, $options: "i" };

    const rows = await Transaction.find(filter)
      .sort({ date: -1, _id: -1 })
      .limit(limit);
    return ok(rows);
  });
}

export async function POST(req: Request) {
  return withUser(async (user) => {
    await connectToDatabase();
    const b = await req.json();
    const type = String(b.type ?? "expense");
    if (!TX_TYPES.includes(type as never)) return bad("Invalid transaction type");
    const amount = Number(b.amount);
    if (!(amount > 0)) return bad("Amount must be greater than 0");
    const row = await Transaction.create({
      userId: user.id,
      type,
      amount,
      date: String(b.date ?? new Date().toISOString().slice(0, 10)),
      categoryId: b.categoryId ? b.categoryId : null,
      accountId: b.accountId ? b.accountId : null,
      toAccountId: b.toAccountId ? b.toAccountId : null,
      description: String(b.description ?? ""),
      meta: b.meta ?? null,
    });
    return ok(row);
  });
}

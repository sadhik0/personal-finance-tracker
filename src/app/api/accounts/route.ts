import { connectToDatabase } from "@/backend/db/connect";
import { Account, Transaction } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";
import { accountBalances } from "@/backend/services/finance.service";

export async function GET() {
  return withUser(async (user) => {
    await connectToDatabase();
    const accs = await Account.find({ userId: user.id }).sort({ sortOrder: 1, _id: 1 });
    const txDocs = await Transaction.find({ userId: user.id });
    const plainAccs = accs.map((a) => a.toJSON());
    const plainTxs = txDocs.map((t) => t.toJSON());
    const balances = accountBalances(plainAccs, plainTxs as never);
    return ok(plainAccs.map((a) => ({ ...a, balance: balances.get(a.id) ?? 0 })));
  });
}

export async function POST(req: Request) {
  return withUser(async (user) => {
    await connectToDatabase();
    const b = await req.json();
    const row = await Account.create({
      userId: user.id,
      name: String(b.name ?? "Account"),
      kind: String(b.kind ?? "bank"),
      openingBalance: Number(b.openingBalance ?? 0),
    });
    return ok(row);
  });
}

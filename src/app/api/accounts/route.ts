import { connectToDatabase } from "@/backend/db/connect";
import { Account, Transaction } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";
import { accountBalances } from "@/backend/services/finance.service";
import { num, oneOf, readJson, text } from "@/backend/utils/validate";

const ACCOUNT_KINDS = ["bank", "cash", "investment", "pf", "loan"] as const;

export async function GET() {
  return withUser(async (user) => {
    await connectToDatabase();
    const accs = await Account.find({ userId: user.id }).sort({ sortOrder: 1, _id: 1 });
    const txDocs = await Transaction.find({ userId: user.id, deletedAt: null });
    const plainAccs = accs.map((a) => a.toJSON());
    const plainTxs = txDocs.map((t) => t.toJSON());
    const balances = accountBalances(plainAccs, plainTxs as never);
    return ok(plainAccs.map((a) => ({ ...a, balance: balances.get(a.id) ?? 0 })));
  });
}

export async function POST(req: Request) {
  return withUser(async (user) => {
    await connectToDatabase();
    const b = await readJson(req);
    const row = await Account.create({
      userId: user.id,
      name: text(b.name, "Name", { max: 100, min: 1, fallback: "Account" }),
      kind: oneOf(b.kind, "Kind", ACCOUNT_KINDS, "bank"),
      openingBalance: b.openingBalance === undefined || b.openingBalance === "" ? 0 : num(b.openingBalance, "Opening balance"),
    });
    return ok(row);
  });
}

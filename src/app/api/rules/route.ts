import { connectToDatabase } from "@/backend/db/connect";
import { Account, ExpectedRule, Transaction } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";
import { accountBalances, num as toNumber } from "@/backend/services/finance.service";
import { bool, idOrNull, num, oneOf, readJson, text } from "@/backend/utils/validate";
import { mustOwn } from "@/backend/utils/ownership";

const RULE_KINDS = ["salary", "interest", "loan_interest"] as const;

export async function GET(req: Request) {
  return withUser(req, async (user) => {
    await connectToDatabase();
    const rows = await ExpectedRule.find({ userId: user.id }).sort({ _id: 1 });
    const plain = rows.map((r) => r.toJSON());

    const needsBalance = plain.some((r) => r.kind === "loan_interest" && r.accountId);
    if (!needsBalance) return ok(plain);

    // Compute the current outstanding balance for any loan account referenced by
    // a loan_interest rule, so the dashboard can suggest this month's accrual
    // (rate% of what's currently owed) without the user typing it from memory.
    const [accs, txs] = await Promise.all([
      Account.find({ userId: user.id }),
      Transaction.find({ userId: user.id }),
    ]);
    const balances = accountBalances(
      accs.map((a) => a.toJSON()),
      txs.map((t) => t.toJSON()),
    );

    const enriched = plain.map((r) => {
      if (r.kind !== "loan_interest" || !r.accountId) return r;
      const owed = Math.abs(Math.min(balances.get(r.accountId) ?? 0, 0));
      const rate = toNumber(r.ratePct);
      return { ...r, suggestedAmount: Math.round(owed * (rate / 100) * 100) / 100 };
    });
    return ok(enriched);
  });
}

export async function POST(req: Request) {
  return withUser(req, async (user) => {
    await connectToDatabase();
    const b = await readJson(req);
    const accountId = await mustOwn(Account, user.id, idOrNull(b.accountId, "accountId"), "Account");
    const row = await ExpectedRule.create({
      userId: user.id,
      kind: oneOf(b.kind, "Kind", RULE_KINDS, "salary"),
      label: text(b.label, "Label", { max: 100 }),
      amount: b.amount ? num(b.amount, "Amount", { min: 0 }) : null,
      ratePct:
        b.ratePct !== undefined && b.ratePct !== "" && b.ratePct !== null
          ? num(b.ratePct, "Rate", { min: 0, max: 1000 })
          : null,
      dayOfMonth: b.dayOfMonth === undefined ? 30 : Math.round(num(b.dayOfMonth, "Day of month", { min: 1, max: 31 })),
      accountId,
      active: b.active === undefined ? true : bool(b.active, "active"),
    });
    return ok(row);
  });
}
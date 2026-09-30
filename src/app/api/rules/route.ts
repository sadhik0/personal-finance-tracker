import { connectToDatabase } from "@/backend/db/connect";
import { Account, ExpectedRule, Transaction } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";
import { accountBalances, shiftPeriod, num as toNumber } from "@/backend/services/finance.service";
import { bool, idOrNull, num, oneOf, readJson, text } from "@/backend/utils/validate";
import { mustOwn } from "@/backend/utils/ownership";

const RULE_KINDS = ["salary", "interest", "loan_interest"] as const;

function monthFromDate(value: Date | string | undefined) {
  const date = value ? new Date(value) : new Date();
  return date.toISOString().slice(0, 7);
}

export async function GET(req: Request) {
  return withUser(req, async (user) => {
    await connectToDatabase();
    const rows = await ExpectedRule.find({ userId: user.id }).sort({ _id: 1 });
    const plain = rows.map((r) => r.toJSON() as Record<string, any>);
    const ruleIds = rows.map((r) => r.id);

    // Existing rule-created entries count as handled even if they predate the
    // handledPeriods field. This is intentionally read-only: no migration is needed.
    const existing = ruleIds.length
      ? await Transaction.find({ userId: user.id, "meta.source": "expected_rule", "meta.ruleId": { $in: ruleIds } })
      : [];
    const handledByRule = new Map<string, Set<string>>();
    for (const tx of existing) {
      const ruleId = String(tx.meta?.ruleId ?? "");
      const period = tx.meta?.rulePeriod || tx.date?.slice(0, 7);
      if (!ruleId || !period) continue;
      const periods = handledByRule.get(ruleId) ?? new Set<string>();
      periods.add(String(period));
      handledByRule.set(ruleId, periods);
    }

    const needsBalance = plain.some((r) => r.kind === "loan_interest" && r.accountId);
    let balances = new Map<string, number>();
    if (needsBalance) {
      const [accs, txs] = await Promise.all([
        Account.find({ userId: user.id }),
        Transaction.find({ userId: user.id }),
      ]);
      balances = accountBalances(
        accs.map((a) => a.toJSON()),
        txs.map((t) => t.toJSON()),
      );
    }

    const enriched = plain.map((r, index) => {
      const periods = new Set<string>([
        ...(Array.isArray(r.handledPeriods) ? r.handledPeriods : []),
        ...(r.lastHandledPeriod ? [r.lastHandledPeriod] : []),
        ...(handledByRule.get(String(r.id)) ?? []),
      ]);
      const result: Record<string, any> = {
        ...r,
        handledPeriods: [...periods],
        // Existing documents may not have createdAt; ObjectId timestamps give
        // them the correct historical start month without a migration.
        createdPeriod: monthFromDate(r.createdAt ?? rows[index]._id.getTimestamp()),
      };
      if (r.kind === "loan_interest" && r.accountId) {
        const owed = Math.abs(Math.min(balances.get(r.accountId) ?? 0, 0));
        const rate = toNumber(r.ratePct);
        result.suggestedAmount = Math.round(owed * (rate / 100) * 100) / 100;
      }
      return result;
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

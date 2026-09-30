import { connectToDatabase } from "@/backend/db/connect";
import { Category, ExpectedRule, Transaction } from "@/backend/models";
import { bad, ok, withUser } from "@/backend/utils/response";
import { monthRange, shiftPeriod } from "@/backend/services/finance.service";
import { isoDate, oneOf, paramId, period as periodOf, positive, readJson } from "@/backend/utils/validate";

type Ctx = { params: Promise<{ id: string }> };

/** body: { action: 'confirm'|'skip', amount?, date?, period } */
export async function POST(req: Request, ctx: Ctx) {
  return withUser(req, async (user) => {
    await connectToDatabase();
    const id = paramId((await ctx.params).id);
    const b = await readJson(req);
    const rule = await ExpectedRule.findOne({ _id: id, userId: user.id });
    if (!rule) return bad("Rule not found", 404);
    const action = oneOf(b.action, "action", ["confirm", "skip"] as const);
    const period = periodOf(b.period, "period");

    if (action === "skip") {
      rule.lastHandledPeriod = period;
      await rule.save();
      return ok({ skipped: true });
    }

    // Salary / interest can be recorded for the current month or the next one, nothing further ahead.
    // (14 hours of slack: the user's calendar can be ahead of UTC.)
    const nowMonth = new Date(Date.now() + 14 * 3600 * 1000).toISOString().slice(0, 7);
    if (period > shiftPeriod(nowMonth, 1)) return bad("Only this month and next month can be confirmed", 400);

    const amount = positive(b.amount ?? rule.amount ?? 0, "Amount");

    let categoryId: string | null = null;
    if (rule.kind === "salary") {
      const cat = await Category.findOne({ userId: user.id, name: "Salary" });
      categoryId = cat?.id ?? null;
    }

    // The entry belongs to the month being confirmed. If the client's date is in a
    // different month (e.g. confirming October's salary on 29 September), use the
    // rule's day-of-month inside that period instead of silently landing in the wrong month.
    const asked = b.date === undefined ? new Date().toISOString().slice(0, 10) : isoDate(b.date, "Date");
    const lastDay = Number(monthRange(period).end.slice(8, 10));
    const entryDate =
      asked.slice(0, 7) === period
        ? asked
        : `${period}-${String(Math.min(Math.max(rule.dayOfMonth || 1, 1), lastDay)).padStart(2, "0")}`;

    const isLoanInterest = rule.kind === "loan_interest";
    const tx = await Transaction.create({
      userId: user.id,
      type: rule.kind === "salary" ? "income" : isLoanInterest ? "loan_interest_accrual" : "interest",
      amount,
      date: entryDate,
      // A cash interest/salary transaction lands IN an account; a loan interest
      // accrual has no source account at all — it grows the loan's own balance.
      accountId: isLoanInterest ? null : rule.accountId,
      toAccountId: isLoanInterest ? rule.accountId : null,
      categoryId,
      description: rule.label || (rule.kind === "salary" ? "Salary" : isLoanInterest ? "Loan interest accrual" : "Bank interest"),
      meta: { source: "expected_rule", ruleId: rule.id },
    });

    rule.lastHandledPeriod = period;
    rule.amount = amount;
    await rule.save();

    return ok(tx);
  });
}
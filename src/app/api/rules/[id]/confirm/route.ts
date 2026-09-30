import { connectToDatabase } from "@/backend/db/connect";
import { Category, ExpectedRule, Transaction } from "@/backend/models";
import { bad, ok, withUser } from "@/backend/utils/response";
import { monthRange, shiftPeriod } from "@/backend/services/finance.service";
import { isoDate, oneOf, paramId, period as periodOf, positive, readJson } from "@/backend/utils/validate";

type Ctx = { params: Promise<{ id: string }> };

function isDuplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;
}

async function alreadyRecorded(userId: string, ruleId: string, period: string) {
  const { start, end } = monthRange(period);
  return Transaction.exists({
    userId,
    "meta.source": "expected_rule",
    "meta.ruleId": ruleId,
    $or: [{ "meta.rulePeriod": period }, { date: { $gte: start, $lte: end } }],
  });
}

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
    const handled = Array.isArray(rule.handledPeriods) ? rule.handledPeriods : [];
    const hasExistingEntry = await alreadyRecorded(user.id, rule.id, period);
    const isHandled = handled.includes(period) || rule.lastHandledPeriod === period || Boolean(hasExistingEntry);

    // Skipping is deliberately idempotent: an already handled month needs no write.
    if (action === "skip") {
      if (!isHandled) {
        await ExpectedRule.updateOne(
          { _id: rule.id, userId: user.id },
          { $addToSet: { handledPeriods: period }, $set: { lastHandledPeriod: period } },
        );
      }
      return ok({ skipped: true, alreadyHandled: isHandled });
    }

    if (isHandled) return bad("This month is already recorded", 409);

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
    try {
      const tx = await Transaction.create({
        userId: user.id,
        type: rule.kind === "salary" ? "income" : isLoanInterest ? "loan_interest_accrual" : "interest",
        amount,
        date: entryDate,
        accountId: isLoanInterest ? null : rule.accountId,
        toAccountId: isLoanInterest ? rule.accountId : null,
        categoryId,
        description: rule.label || (rule.kind === "salary" ? "Salary" : isLoanInterest ? "Loan interest accrual" : "Bank interest"),
        meta: { source: "expected_rule", ruleId: rule.id, rulePeriod: period },
      });

      await ExpectedRule.updateOne(
        { _id: rule.id, userId: user.id },
        { $addToSet: { handledPeriods: period }, $set: { lastHandledPeriod: period, amount } },
      );
      return ok(tx);
    } catch (error) {
      // ExpectedRule's unique index makes two devices/double taps converge safely.
      if (isDuplicateKey(error)) return bad("This month is already recorded", 409);
      throw error;
    }
  });
}

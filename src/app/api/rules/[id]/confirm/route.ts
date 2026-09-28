import { connectToDatabase } from "@/backend/db/connect";
import { Category, ExpectedRule, Transaction } from "@/backend/models";
import { bad, ok, withUser } from "@/backend/utils/response";
import { isoDate, oneOf, paramId, period as periodOf, positive, readJson } from "@/backend/utils/validate";

type Ctx = { params: Promise<{ id: string }> };

/** body: { action: 'confirm'|'skip', amount?, date?, period } */
export async function POST(req: Request, ctx: Ctx) {
  return withUser(async (user) => {
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

    const amount = positive(b.amount ?? rule.amount ?? 0, "Amount");

    let categoryId: string | null = null;
    if (rule.kind === "salary") {
      const cat = await Category.findOne({ userId: user.id, name: "Salary" });
      categoryId = cat?.id ?? null;
    }

    const isLoanInterest = rule.kind === "loan_interest";
    const tx = await Transaction.create({
      userId: user.id,
      type: rule.kind === "salary" ? "income" : isLoanInterest ? "loan_interest_accrual" : "interest",
      amount,
      date: b.date === undefined ? new Date().toISOString().slice(0, 10) : isoDate(b.date, "Date"),
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
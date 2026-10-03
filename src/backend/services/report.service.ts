import { connectToDatabase } from "@/backend/db/connect";
import { Transaction } from "@/backend/models";
import {
  accountBalances,
  addDays,
  bucketTotals,
  categorySpending,
  daysBetween,
  loadContext,
  monthRange,
  num,
  shiftPeriod,
  summarize,
  type Tx,
} from "./finance.service";
import { computeBudget, legacyPlan, type Framework, type PlanEntry } from "@/shared/budget";

const lastDay = (month: string) => monthRange(month).end;

/**
 * @param range   an explicit date range (quarter / half-year / year / custom)
 * @param opts    prevRange: the range to compare against (defaults to an equally long range before)
 *                kind/label: period type and display label, echoed back for the UI and exports
 */
export async function buildReport(
  userId: string,
  period: string,
  monthsBack = 6,
  range?: { start: string; end: string },
  opts: { prevRange?: { start: string; end: string }; kind?: string; label?: string; title?: string } = {},
) {
  await connectToDatabase();
  const custom = !!(range && range.start && range.end && range.start <= range.end);
  const { start, end } = custom ? range! : monthRange(period);
  const ctx = await loadContext(userId);

  const allTxDocs = await Transaction.find({ userId, deletedAt: null });
  const allTx = allTxDocs.map((t) => t.toJSON()) as Tx[];

  const periodTx = allTx.filter((t) => t.date >= start && t.date <= end);
  const upToEnd = allTx.filter((t) => t.date <= end);

  const s = summarize(periodTx);
  const prev = summarize(
    custom
      ? (() => {
          if (opts.prevRange) {
            const pr = opts.prevRange;
            return allTx.filter((t) => t.date >= pr.start && t.date <= pr.end);
          }
          const spanDays = daysBetween(start, end) + 1;
          const prevEnd = addDays(start, -1);
          const prevStart = addDays(start, -spanDays);
          return allTx.filter((t) => t.date >= prevStart && t.date <= prevEnd);
        })()
      : (() => {
          const r = monthRange(shiftPeriod(period, -1));
          return allTx.filter((t) => t.date >= r.start && t.date <= r.end);
        })(),
  );

  const balances = accountBalances(ctx.accounts, upToEnd);
  const accountsWithBalance = ctx.accounts.map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    balance: balances.get(a.id) ?? 0,
  }));

  const assets = accountsWithBalance
    .filter((a) => a.kind !== "loan")
    .reduce((acc, a) => acc + a.balance, 0);
  const liabilities = accountsWithBalance
    .filter((a) => a.kind === "loan")
    .reduce((acc, a) => acc + Math.abs(Math.min(a.balance, 0)), 0);

  const buckets = bucketTotals(periodTx, ctx.categories);
  const st = ctx.settings;

  // Every month the period touches, with that month's salary base. The budget
  // is worked out month by month, because the active plan can change between
  // months (see src/shared/budget.ts).
  const periodMonths: string[] = [];
  for (let m = start.slice(0, 7); m <= end.slice(0, 7); m = shiftPeriod(m, 1)) periodMonths.push(m);
  const monthTx = new Map<string, Tx[]>();
  for (const m of periodMonths) monthTx.set(m, []);
  for (const t of periodTx) monthTx.get(t.date.slice(0, 7))?.push(t);
  const monthSummaries = periodMonths.map((m) => ({ month: m, s: summarize(monthTx.get(m) ?? []), n: monthTx.get(m)?.length ?? 0 }));

  const base = s.income; // salary-based budget base (excludes family + interest)
  const savingsForBudget = s.savings;
  const history: PlanEntry[] = ((st?.planHistory ?? []) as Record<string, unknown>[]).map((e) => ({
    from: String(e.from),
    framework: e.framework as Framework,
    allocation: { needs: num(e.needs), wants: num(e.wants), loan: num(e.loan), savings: num(e.savings) },
  }));
  const computed = computeBudget({
    months: monthSummaries.map((m) => ({ month: m.month, base: m.s.income })),
    history,
    legacy: legacyPlan(st),
    actual: {
      needs: buckets.needs,
      wants: buckets.wants,
      loan: s.loanPayment,
      savings: Math.max(savingsForBudget, 0),
    },
    savingsRaw: savingsForBudget,
  });
  const pctOfKey = (k: "needs" | "wants" | "loan" | "savings") =>
    computed.buckets.find((x) => x.key === k)?.pct ?? 0;
  const budget = {
    ...computed,
    // Kept for older callers: percentages of the three classic buckets.
    benchmark: { needs: 50, wants: 30, savings: 20 },
    plan: {
      needsPct: pctOfKey("needs"),
      wantsPct: pctOfKey("wants"),
      loanPct: pctOfKey("loan"),
      savingsPct: pctOfKey("savings"),
      framework: computed.framework,
      isCustom: computed.framework === "custom",
    },
    actualPct: base
      ? {
          needs: (buckets.needs / base) * 100,
          wants: (buckets.wants / base) * 100,
          loan: (s.loanPayment / base) * 100,
          savings: (savingsForBudget / base) * 100,
        }
      : { needs: 0, wants: 0, loan: 0, savings: 0 },
  };

  // Month-by-month breakdown + summary (drives quarterly / half-yearly / yearly statements).
  const today = new Date().toISOString().slice(0, 10);
  const monthly = monthSummaries.map(({ month, s: ms, n }) => ({
    period: month,
    hasData: n > 0,
    elapsed: month + "-01" <= today,
    income: ms.income,
    interest: ms.interest,
    expense: ms.expense,
    investment: ms.investment,
    loanPayment: ms.loanPayment,
    familyIn: ms.familyIn,
    familyOut: ms.familyOut,
    savings: ms.savings,
    net: ms.netCashFlow,
  }));
  // Averages and highest/lowest only count months that have started AND have data,
  // so future or pre-app months never show up as "lowest spending month".
  const active = monthly.filter((m) => m.elapsed && m.hasData);
  const pick = (better: (a: number, b: number) => boolean) =>
    active.reduce<{ period: string; amount: number } | null>(
      (best, m) => (best === null || better(m.expense, best.amount) ? { period: m.period, amount: m.expense } : best),
      null,
    );
  const summary = {
    months: monthly.length,
    activeMonths: active.length,
    avgMonthlySpending: active.length ? active.reduce((a, m) => a + m.expense, 0) / active.length : 0,
    avgMonthlySavings: active.length ? active.reduce((a, m) => a + m.savings, 0) / active.length : 0,
    avgMonthlyIncome: active.length ? active.reduce((a, m) => a + m.income + m.interest, 0) / active.length : 0,
    highestSpendingMonth: pick((a, b) => a > b),
    lowestSpendingMonth: pick((a, b) => a < b),
    highestInvestmentMonth: active.reduce<{ period: string; amount: number } | null>(
      (best, m) => (best === null || m.investment > best.amount ? { period: m.period, amount: m.investment } : best),
      null,
    ),
  };

  const categories = categorySpending(periodTx, ctx.categories);

  const topExpenses = periodTx
    .filter((t) => t.type === "expense" || t.type === "loan_repayment" || t.type === "family_out")
    .sort((a, b) => num(b.amount) - num(a.amount))
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      amount: num(t.amount),
      date: t.date,
      description: t.description,
      category:
        ctx.categories.find((c) => c.id === t.categoryId)?.name ??
        (t.type === "loan_repayment" ? "Education Loan" : t.type === "family_out" ? "Family Support" : "Other"),
    }));

  const trend: {
    period: string;
    income: number;
    expense: number;
    savings: number;
    investment: number;
    familyIn: number;
    familyOut: number;
    loanPayment: number;
    net: number;
  }[] = [];
  let trendGranularity: "day" | "month" = "month";

  function pushTrendPoint(label: string, txs: Tx[]) {
    const ps = summarize(txs);
    trend.push({
      period: label,
      income: ps.income + ps.interest,
      expense: ps.expense,
      savings: ps.savings,
      investment: ps.investment,
      familyIn: ps.familyIn,
      familyOut: ps.familyOut,
      loanPayment: ps.loanPayment,
      net: ps.netCashFlow,
    });
  }

  if (custom) {
    const spanDays = daysBetween(start, end) + 1;
    if (spanDays <= 45) {
      trendGranularity = "day";
      for (let d = 0; d < spanDays; d++) {
        const day = addDays(start, d);
        pushTrendPoint(
          day,
          allTx.filter((t) => t.date === day),
        );
      }
    } else {
      let p = start.slice(0, 7);
      const endPeriod = end.slice(0, 7);
      while (p <= endPeriod) {
        const r = monthRange(p);
        const from = r.start < start ? start : r.start;
        const to = r.end > end ? end : r.end;
        pushTrendPoint(
          p,
          allTx.filter((t) => t.date >= from && t.date <= to),
        );
        p = shiftPeriod(p, 1);
      }
    }
  } else {
    for (let i = monthsBack - 1; i >= 0; i--) {
      const p = shiftPeriod(period, -i);
      const r = monthRange(p);
      pushTrendPoint(
        p,
        allTx.filter((t) => t.date >= r.start && t.date <= r.end),
      );
    }
  }

  // limits & alerts
  const limits = ctx.categories
    .filter((c) => c.limitMode && c.limitValue != null && !c.disabled)
    .map((c) => {
      const limit =
        c.limitMode === "percent" ? (base * num(c.limitValue)) / 100 : num(c.limitValue);
      const spent = periodTx
        .filter(
          (t) =>
            t.type === "expense" &&
            (t.categoryId === c.id ||
              ctx.categories.some((k) => k.id === t.categoryId && k.parentId === c.id)),
        )
        .reduce((acc, t) => acc + num(t.amount), 0);
      const pct = limit ? (spent / limit) * 100 : 0;
      return { id: c.id, name: c.name, limit, spent, pct };
    })
    .sort((a, b) => b.pct - a.pct);

  const alerts: { level: "info" | "warning" | "danger" | "success"; text: string }[] = [];
  for (const l of limits) {
    if (l.pct >= 100)
      alerts.push({
        level: "danger",
        text: `${l.name} spending has exceeded your configured limit by ₹${Math.round(l.spent - l.limit).toLocaleString("en-IN")}.`,
      });
    else if (l.pct >= 90)
      alerts.push({
        level: "warning",
        text: `${l.name} spending has reached ${Math.round(l.pct)}% of your configured limit.`,
      });
  }
  if (base === 0)
    alerts.push({
      level: "info",
      text: "Salary not configured for this period. Confirm your salary to activate budget analysis.",
    });
  if (base > 0 && budget.plan.savingsPct > 0 && budget.actualPct.savings >= budget.plan.savingsPct)
    alerts.push({
      level: "success",
      text: `Your savings rate is ${budget.actualPct.savings.toFixed(1)}% — at or above your ${budget.plan.savingsPct}% target.`,
    });
  if (s.familyOut > prev.familyOut && prev.familyOut > 0)
    alerts.push({
      level: "info",
      text: `Family support given is ₹${Math.round(s.familyOut - prev.familyOut).toLocaleString("en-IN")} higher than last month.`,
    });

  return {
    period,
    kind: opts.kind ?? "month",
    label: opts.label ?? null,
    title: opts.title ?? null,
    range: { start, end, custom, trendGranularity },
    monthly,
    summary,
    kpi: {
      income: s.income,
      interest: s.interest,
      expense: s.expense,
      savings: savingsForBudget,
      netCashFlow: s.netCashFlow,
      investment: s.investment,
      familyIn: s.familyIn,
      familyOut: s.familyOut,
      netFamily: s.netFamily,
      loanPayment: s.loanPayment,
      pfEmployee: s.pfEmployee,
      pfEmployer: s.pfEmployer,
      pfTotal: s.pfEmployee + s.pfEmployer,
      savingsRate: base ? (savingsForBudget / base) * 100 : 0,
    },
    prev: { income: prev.income, expense: prev.expense, savings: prev.savings },
    budget,
    categories,
    topExpenses,
    trend,
    limits,
    alerts,
    accounts: accountsWithBalance,
    balanceSheet: { assets, liabilities, net: assets - liabilities },
    statements: buildStatements(periodTx, ctx.categories, accountsWithBalance, s),
  };
}

function buildStatements(
  periodTx: Tx[],
  cats: { id: string; name: string; parentId: string | null; bucket: string }[],
  accs: { id: string; name: string; kind: string; balance: number }[],
  s: ReturnType<typeof summarize>,
) {
  const incomeLines = new Map<string, number>();
  for (const t of periodTx) {
    if (t.type === "income")
      incomeLines.set(
        cats.find((c) => c.id === t.categoryId)?.name ?? "Salary",
        (incomeLines.get(cats.find((c) => c.id === t.categoryId)?.name ?? "Salary") ?? 0) +
          num(t.amount),
      );
    if (t.type === "interest")
      incomeLines.set("Bank Interest", (incomeLines.get("Bank Interest") ?? 0) + num(t.amount));
  }
  const expenseLines = categorySpending(periodTx, cats).map((c) => ({
    name: c.name,
    amount: c.total,
  }));

  return {
    incomeExpense: {
      income: [...incomeLines.entries()].map(([name, amount]) => ({ name, amount })),
      totalIncome: s.income + s.interest,
      expenses: expenseLines,
      totalExpenses: s.expense,
      familyIn: s.familyIn,
      familyOut: s.familyOut,
      loanPayment: s.loanPayment,
      netSurplus: s.income + s.interest - s.expense - s.familyOut - s.loanPayment + s.familyIn,
    },
    balanceSheet: {
      assets: accs.filter((a) => a.kind !== "loan"),
      liabilities: accs
        .filter((a) => a.kind === "loan")
        .map((a) => ({ ...a, balance: Math.abs(Math.min(a.balance, 0)) })),
    },
    cashFlow: {
      operating: [
        { name: "Salary & income", amount: s.income },
        { name: "Bank interest", amount: s.interest },
        { name: "Expenses", amount: -s.expense },
        { name: "Family support received", amount: s.familyIn },
        { name: "Family support given", amount: -s.familyOut },
      ],
      investing: [{ name: "Investment contributions", amount: -s.investment }],
      financing: [{ name: "Education loan payments", amount: -s.loanPayment }],
      transfers: [{ name: "Internal transfers (wealth neutral)", amount: s.transfers }],
      net: s.netCashFlow,
    },
  };
}
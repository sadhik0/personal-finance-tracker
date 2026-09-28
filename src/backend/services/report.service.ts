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

export async function buildReport(
  userId: string,
  period: string,
  monthsBack = 6,
  range?: { start: string; end: string },
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
  const base = s.income; // salary-based budget base (excludes family + interest)
  const st = ctx.settings;
  const plan = {
    needsPct: num(st?.customNeedsPct ?? st?.needsPct ?? 50),
    wantsPct: num(st?.customWantsPct ?? st?.wantsPct ?? 30),
    savingsPct: num(st?.customSavingsPct ?? st?.savingsPct ?? 20),
    isCustom: st?.customNeedsPct != null,
  };
  const savingsForBudget = s.income - s.expense - s.familyOut - s.loanPayment;
  const budget = {
    base,
    benchmark: { needs: 50, wants: 30, savings: 20 },
    plan,
    targets: {
      needs: (base * plan.needsPct) / 100,
      wants: (base * plan.wantsPct) / 100,
      savings: (base * plan.savingsPct) / 100,
    },
    actual: {
      needs: buckets.needs,
      wants: buckets.wants,
      savings: Math.max(savingsForBudget, 0),
    },
    actualPct: base
      ? {
          needs: (buckets.needs / base) * 100,
          wants: (buckets.wants / base) * 100,
          savings: (savingsForBudget / base) * 100,
        }
      : { needs: 0, wants: 0, savings: 0 },
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
  if (base > 0 && budget.actualPct.savings >= plan.savingsPct)
    alerts.push({
      level: "success",
      text: `Your savings rate is ${budget.actualPct.savings.toFixed(1)}% — at or above your ${plan.savingsPct}% benchmark.`,
    });
  if (s.familyOut > prev.familyOut && prev.familyOut > 0)
    alerts.push({
      level: "info",
      text: `Family support given is ₹${Math.round(s.familyOut - prev.familyOut).toLocaleString("en-IN")} higher than last month.`,
    });

  return {
    period,
    range: { start, end, custom, trendGranularity },
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
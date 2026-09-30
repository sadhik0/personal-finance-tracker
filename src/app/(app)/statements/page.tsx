"use client";

import { useState } from "react";
import { Bar as RBar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTxSaved } from "@/frontend/lib/useTxSaved";
import { useApiResource } from "@/frontend/lib/apiCache";
import { inr } from "@/frontend/lib/client";
import { Bar, Card, Empty, KPI, Toast, fmtTip, TOOLTIP_STYLE, type Report } from "@/frontend/components/ui";
import { StatementsSkeleton } from "@/frontend/components/Skeleton";
import { exportExcel, exportPDF } from "@/frontend/lib/export";
import {
  PERIOD_KINDS,
  convertPeriodKey,
  periodBounds,
  periodKeyFor,
  monthLabel,
  shiftPeriodKey,
  type PeriodKind,
} from "@/shared/periods";

const TABS = ["Income & Expense", "Balance Sheet", "Cash Flow"] as const;

/** Recent periods of a kind (newest first), always including the selected one. */
function periodChoices(kind: PeriodKind, selected: string) {
  const count = { month: 24, quarter: 12, half: 8, year: 6 }[kind];
  const now = periodKeyFor(kind);
  const keys: string[] = [];
  for (let i = 0; i < count; i++) keys.push(shiftPeriodKey(kind, now, -i));
  if (!keys.includes(selected)) keys.push(selected);
  keys.sort().reverse();
  return keys.map((key) => ({ key, label: periodBounds(kind, key).title }));
}

export default function StatementsPage() {
  const [kind, setKind] = useState<PeriodKind>("month");
  const [key, setKey] = useState(periodKeyFor("month"));
  const [tab, setTab] = useState<(typeof TABS)[number]>("Income & Expense");
  const [toast, setToast] = useState<string | null>(null);

  const saved = useTxSaved();
  const url = kind === "month" ? `/api/report?period=${key}` : `/api/report?kind=${kind}&key=${key}`;
  const { data: report, loading, error: offline } = useApiResource<Report>(url, saved);

  const bounds = periodBounds(kind, key);

  function changeKind(next: PeriodKind) {
    setKey(convertPeriodKey(kind, key, next));
    setKind(next);
  }

  if (!report)
    return offline ? (
      <div className="py-20 text-center text-[#94A3B8]">
        Can&apos;t load statements right now. They will refresh when you are back online.
      </div>
    ) : (
      <StatementsSkeleton />
    );
  const st = report.statements;
  const multi = report.monthly.length > 1;

  async function run(fn: () => Promise<void>, msg: string) {
    await fn();
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  return (
    <div className={`space-y-4 ${loading ? "refreshing" : ""}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold">Statements</h1>
          <p className="text-sm text-[#94A3B8]">
            {bounds.title}
            {offline ? " · offline, numbers may be out of date" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-ghost text-xs" onClick={() => run(() => exportExcel(report), "Excel exported")}>
            ▤ Export Excel
          </button>
          <button className="btn btn-primary text-xs" onClick={() => run(() => exportPDF(report, "Personal"), "PDF exported")}>
            ▦ Export PDF
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-[#263449] overflow-hidden" role="tablist" aria-label="Period type">
          {PERIOD_KINDS.map((p) => (
            <button
              key={p.kind}
              role="tab"
              aria-selected={kind === p.kind}
              onClick={() => changeKind(p.kind)}
              className={`px-3 py-1.5 text-xs ${kind === p.kind ? "bg-[#172033] text-[#38BDF8]" : "text-[#94A3B8]"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost text-xs" aria-label="Previous period" onClick={() => setKey(shiftPeriodKey(kind, key, -1))}>
          ←
        </button>
        <select className="input w-auto min-w-[170px] text-sm" value={key} onChange={(e) => setKey(e.target.value)}>
          {periodChoices(kind, key).map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <button className="btn btn-ghost text-xs" aria-label="Next period" onClick={() => setKey(shiftPeriodKey(kind, key, 1))}>
          →
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Income" value={report.kpi.income + report.kpi.interest} tone="pos" />
        <KPI label="Expenses" value={report.kpi.expense} tone="neg" />
        <KPI label="Investments" value={report.kpi.investment} tone="accent" />
        <KPI label="Loan repayment" value={report.kpi.loanPayment} tone="warn" />
        <KPI label="Family support (net)" value={report.kpi.netFamily} sub={`Given ${inr(report.kpi.familyOut)}`} />
        <KPI label="Savings" value={report.kpi.savings} tone={report.kpi.savings >= 0 ? "pos" : "neg"} />
        <KPI label="Cash flow" value={report.kpi.netCashFlow} tone={report.kpi.netCashFlow >= 0 ? "pos" : "neg"} />
        <KPI label="Net position" value={report.balanceSheet.net} tone="accent" />
      </div>

      <Card
        title={`Budget vs actual`}
        right={<span className="text-xs text-[#94A3B8]">{report.budget.frameworkLabel}</span>}
      >
        {report.budget.base === 0 ? (
          <Empty text="No salary recorded in this period, so there is no budget base." />
        ) : (
          <div className="space-y-3">
            {report.budget.buckets.map((b) => {
              const goal = b.kind === "goal";
              return (
                <div key={b.key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>
                      {b.label} <span className="text-xs text-[#94A3B8]">{b.pct}%</span>
                    </span>
                    <span className="tabular-nums text-[#94A3B8]">
                      {inr(b.actual)} / {inr(b.target)} · {b.progressPct.toFixed(0)}% {goal ? "achieved" : "used"}
                    </span>
                  </div>
                  <Bar pct={b.progressPct} tone={goal ? (b.progressPct >= 100 ? "#22C55E" : "#8B5CF6") : undefined} />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {multi && (
        <>
          <Card title={`Monthly breakdown · ${bounds.label}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-xs text-[#94A3B8]">
                    <th className="text-left font-normal pb-2 pr-3">&nbsp;</th>
                    {report.monthly.map((m) => (
                      <th key={m.period} className="text-right font-normal pb-2 px-2 whitespace-nowrap">
                        {monthLabel(m.period)}
                      </th>
                    ))}
                    <th className="text-right font-semibold pb-2 pl-3 whitespace-nowrap">{bounds.label} total</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Income", (m) => m.income + m.interest, report.kpi.income + report.kpi.interest],
                      ["Expenses", (m) => m.expense, report.kpi.expense],
                      ["Investments", (m) => m.investment, report.kpi.investment],
                      ["Loan repayment", (m) => m.loanPayment, report.kpi.loanPayment],
                      ["Family given", (m) => m.familyOut, report.kpi.familyOut],
                      ["Family received", (m) => m.familyIn, report.kpi.familyIn],
                      ["Savings", (m) => m.savings, report.kpi.savings],
                    ] as [string, (m: Report["monthly"][number]) => number, number][]
                  ).map(([label, pick, total]) => (
                    <tr key={label} className="border-t border-[#263449]">
                      <td className="py-2 pr-3 whitespace-nowrap">{label}</td>
                      {report.monthly.map((m) => (
                        <td key={m.period} className="py-2 px-2 text-right tabular-nums">
                          {m.elapsed ? inr(pick(m)) : "—"}
                        </td>
                      ))}
                      <td className="py-2 pl-3 text-right font-semibold tabular-nums">{inr(total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Income, expenses and savings by month">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.monthly.map((m) => ({ ...m, name: monthLabel(m.period), income: m.income + m.interest }))}>
                  <CartesianGrid stroke="#263449" vertical={false} />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={fmtTip} />
                  <Legend />
                  <RBar dataKey="income" name="Income" fill="#22C55E" radius={[4, 4, 0, 0]} />
                  <RBar dataKey="expense" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  <RBar dataKey="savings" name="Savings" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title={`${bounds.label} summary`}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Stat label="Average monthly spending" value={inr(report.summary.avgMonthlySpending)} />
              <Stat label="Average monthly savings" value={inr(report.summary.avgMonthlySavings)} />
              <Stat label="Average monthly income" value={inr(report.summary.avgMonthlyIncome)} />
              <Stat
                label="Highest spending month"
                value={report.summary.highestSpendingMonth ? `${monthLabel(report.summary.highestSpendingMonth.period)} · ${inr(report.summary.highestSpendingMonth.amount)}` : "—"}
              />
              <Stat
                label="Lowest spending month"
                value={report.summary.lowestSpendingMonth ? `${monthLabel(report.summary.lowestSpendingMonth.period)} · ${inr(report.summary.lowestSpendingMonth.amount)}` : "—"}
              />
              <Stat
                label="Highest investment month"
                value={report.summary.highestInvestmentMonth ? `${monthLabel(report.summary.highestInvestmentMonth.period)} · ${inr(report.summary.highestInvestmentMonth.amount)}` : "—"}
              />
            </div>
            <p className="mt-3 text-xs text-[#94A3B8]">
              Averages and highest/lowest use the {report.summary.activeMonths} month(s) that have started and have
              transactions.
            </p>
          </Card>
        </>
      )}

      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm border ${
              tab === t ? "border-[#38BDF8] text-[#38BDF8] bg-[#172033]" : "border-[#263449] text-[#94A3B8]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Income & Expense" && (
        <Card title="Personal Income & Expense Statement">
          <Section title="Income">
            {st.incomeExpense.income.length === 0 ? (
              <Empty text="No income recorded." />
            ) : (
              st.incomeExpense.income.map((i) => <Row key={i.name} label={i.name} value={i.amount} />)
            )}
            <Row label="Total income" value={st.incomeExpense.totalIncome} bold />
          </Section>
          <Section title="Expenses">
            {st.incomeExpense.expenses.length === 0 ? (
              <Empty text="No expenses recorded." />
            ) : (
              st.incomeExpense.expenses.map((e) => <Row key={e.name} label={e.name} value={-e.amount} />)
            )}
            <Row label="Total expenses" value={-st.incomeExpense.totalExpenses} bold />
          </Section>
          <Section title="Separate flows">
            <Row label="Family support received" value={st.incomeExpense.familyIn} />
            <Row label="Family support given" value={-st.incomeExpense.familyOut} />
            <Row label="Education loan payment" value={-st.incomeExpense.loanPayment} />
          </Section>
          <Row label="Net surplus" value={st.incomeExpense.netSurplus} bold />
        </Card>
      )}

      {tab === "Balance Sheet" && (
        <Card title="Personal Balance Sheet">
          <Section title="Assets">
            {st.balanceSheet.assets.map((a) => (
              <Row key={a.id} label={a.name} value={a.balance} />
            ))}
            <Row label="Total assets" value={report.balanceSheet.assets} bold />
          </Section>
          <Section title="Liabilities">
            {st.balanceSheet.liabilities.length === 0 ? (
              <Empty text="No liabilities." />
            ) : (
              st.balanceSheet.liabilities.map((a) => <Row key={a.id} label={a.name} value={-a.balance} />)
            )}
            <Row label="Total liabilities" value={-report.balanceSheet.liabilities} bold />
          </Section>
          <Row label="Net position" value={report.balanceSheet.net} bold />
        </Card>
      )}

      {tab === "Cash Flow" && (
        <Card title="Personal Cash Flow Statement">
          <Section title="Operating / personal">
            {st.cashFlow.operating.map((r) => (
              <Row key={r.name} label={r.name} value={r.amount} />
            ))}
          </Section>
          <Section title="Investing">
            {st.cashFlow.investing.map((r) => (
              <Row key={r.name} label={r.name} value={r.amount} />
            ))}
          </Section>
          <Section title="Financing / debt">
            {st.cashFlow.financing.map((r) => (
              <Row key={r.name} label={r.name} value={r.amount} />
            ))}
          </Section>
          <Section title="Transfers (wealth neutral)">
            {st.cashFlow.transfers.map((r) => (
              <Row key={r.name} label={r.name} value={r.amount} muted />
            ))}
          </Section>
          <Row label="Net cash movement" value={st.cashFlow.net} bold />
        </Card>
      )}
      <Toast message={toast} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#0f1829] p-3">
      <p className="text-[11px] text-[#94A3B8]">{label}</p>
      <p className="text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-xs uppercase tracking-wide text-[#94A3B8]">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: number;
  bold?: boolean;
  muted?: boolean;
}) {
  const tone = muted ? "text-[#94A3B8]" : value < 0 ? "text-[#EF4444]" : "text-[#22C55E]";
  return (
    <div
      className={`flex justify-between text-sm ${bold ? "border-t border-[#263449] pt-2 font-semibold" : ""}`}
    >
      <span>{label}</span>
      <span className={`tabular-nums ${tone}`}>{inr(value)}</span>
    </div>
  );
}

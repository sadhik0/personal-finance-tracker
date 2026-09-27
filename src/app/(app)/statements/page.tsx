"use client";

import { useEffect, useState } from "react";
import { api, currentPeriod, inr, periodLabel } from "@/frontend/lib/client";
import { Card, Empty, Toast, type Report } from "@/frontend/components/ui";
import { exportExcel, exportPDF } from "@/frontend/lib/export";

const TABS = ["Income & Expense", "Balance Sheet", "Cash Flow"] as const;

export default function StatementsPage() {
  const [period, setPeriod] = useState(currentPeriod());
  const [tab, setTab] = useState<(typeof TABS)[number]>("Income & Expense");
  const [report, setReport] = useState<Report | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api<Report>(`/api/report?period=${period}`).then(setReport);
  }, [period]);

  if (!report) return <div className="py-20 text-center text-[#94A3B8] animate-pulse">Loading statements…</div>;
  const st = report.statements;

  async function run(fn: () => Promise<void>, msg: string) {
    await fn();
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold">Statements</h1>
          <p className="text-sm text-[#94A3B8]">{periodLabel(period)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" className="input w-[150px]" value={period} onChange={(e) => setPeriod(e.target.value)} />
          <button className="btn btn-ghost text-xs" onClick={() => run(() => exportExcel(report, period), "Excel exported")}>
            ▤ Export Excel
          </button>
          <button className="btn btn-primary text-xs" onClick={() => run(() => exportPDF(report, period, "Personal"), "PDF exported")}>
            ▦ Export PDF
          </button>
        </div>
      </div>

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

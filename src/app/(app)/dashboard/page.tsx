"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar as RBar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, currentPeriod, inr, periodLabel, shiftPeriod, shortPeriod, today } from "@/frontend/lib/client";
import { Bar, Card, CHART_COLORS, Empty, KPI, fmtTip, TOOLTIP_STYLE, type Report } from "@/frontend/components/ui";

type Rule = {
  id: string;
  kind: string;
  label: string;
  amount: string | null;
  ratePct?: string | null;
  dayOfMonth: number;
  active: boolean;
  lastHandledPeriod: string | null;
  suggestedAmount?: number;
};

export default function DashboardPage() {
  const [period, setPeriod] = useState(currentPeriod());
  const [report, setReport] = useState<Report | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [openCat, setOpenCat] = useState<string | null>(null);

  const [offline, setOffline] = useState(false);
  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    const fetchAll = () =>
      Promise.all([api<Report>(`/api/report?period=${period}`), api<Rule[]>("/api/rules")])
        .then(([r, rl]) => {
          if (!alive) return;
          setReport(r);
          setRules(rl);
          setOffline(false);
        })
        .catch(() => {
          // Offline / server hiccup: keep whatever is already on screen.
          if (alive) setOffline(true);
        });
    void fetchAll();
    const h = () => load();
    window.addEventListener("tx-saved", h);
    return () => {
      alive = false;
      window.removeEventListener("tx-saved", h);
    };
  }, [period, tick, load]);

  if (!report)
    return (
      <div className={`py-20 text-center text-[#94A3B8] ${offline ? "" : "animate-pulse"}`}>
        {offline ? "Can't load the dashboard right now. It will refresh when you are back online." : "Loading dashboard…"}
      </div>
    );

  const k = report.kpi;
  const pending = rules.filter((r) => r.active && r.lastHandledPeriod !== period);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold">Dashboard</h1>
          <p className="text-sm text-[#94A3B8]">
            {periodLabel(period)}
            {offline ? " · offline, numbers may be out of date" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost text-xs" onClick={() => setPeriod(shiftPeriod(period, -1))}>
            ←
          </button>
          <input
            type="month"
            className="input w-[150px]"
            value={period}
            onChange={(e) => setPeriod(e.target.value || currentPeriod())}
          />
          <button className="btn btn-ghost text-xs" onClick={() => setPeriod(shiftPeriod(period, 1))}>
            →
          </button>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="space-y-2">
          {pending.map((r) => (
            <PendingRule key={r.id} rule={r} period={period} onDone={load} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Income" value={k.income} tone="pos" icon="↓" sub={`Interest ${inr(k.interest)}`} />
        <KPI label="Expenses" value={k.expense} tone="neg" icon="↑" />
        <KPI
          label="Savings"
          value={k.savings}
          tone="accent"
          icon="◆"
          sub={`Savings rate ${k.savingsRate.toFixed(1)}%`}
        />
        <KPI
          label="Net Cash Flow"
          value={k.netCashFlow}
          tone={k.netCashFlow >= 0 ? "pos" : "neg"}
          icon="⇄"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPI label="Investment" value={k.investment} tone="accent" />
        <KPI label="Family Received" value={k.familyIn} tone="pos" />
        <KPI label="Family Given" value={k.familyOut} tone="warn" />
        <KPI label="Loan Payment" value={k.loanPayment} tone="neg" />
        <KPI label="PF (Total)" value={k.pfTotal} sub={`Emp ${inr(k.pfEmployee)} · Co ${inr(k.pfEmployer)}`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="50 / 30 / 20 Budget" right={<span className="text-xs text-[#94A3B8]">Base {inr(report.budget.base)}</span>}>
          {report.budget.base === 0 ? (
            <Empty text="Salary not configured for this period — budget analysis activates once salary is confirmed." />
          ) : (
            <div className="space-y-4">
              {(["needs", "wants", "savings"] as const).map((key) => {
                const target = report.budget.targets[key];
                const actual = report.budget.actual[key];
                const pct = target ? (actual / target) * 100 : 0;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize">
                        {key}{" "}
                        <span className="text-[#94A3B8] text-xs">
                          benchmark {report.budget.benchmark[key]}% · plan {report.budget.plan[`${key}Pct`]}%
                        </span>
                      </span>
                      <span className="tabular-nums text-[#94A3B8]">
                        {inr(actual)} / {inr(target)}
                      </span>
                    </div>
                    <Bar pct={pct} tone={key === "savings" ? (pct >= 100 ? "#22C55E" : "#8B5CF6") : undefined} />
                  </div>
                );
              })}
              <p className="text-xs text-[#94A3B8]">
                Actual behaviour: {report.budget.actualPct.needs.toFixed(0)} /{" "}
                {report.budget.actualPct.wants.toFixed(0)} /{" "}
                {report.budget.actualPct.savings.toFixed(0)} — benchmark is a reference, not a rule.
              </p>
            </div>
          )}
        </Card>

        <Card title="Spending analysis">
          {report.categories.length === 0 ? (
            <Empty text="No expenses recorded for this period." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3 items-center">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={report.categories}
                      dataKey="total"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                      onClick={(_, i) => setOpenCat(report.categories[i].id)}
                    >
                      {report.categories.map((c, i) => (
                        <Cell key={c.id} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="#111827" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={fmtTip}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
                {report.categories.map((c, i) => {
                  const pct = report.kpi.expense ? (c.total / report.kpi.expense) * 100 : 0;
                  return (
                    <div key={c.id}>
                      <button
                        onClick={() => setOpenCat(openCat === c.id ? null : c.id)}
                        className="w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-[#1b2740]"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                          />
                          {c.name}
                        </span>
                        <span className="tabular-nums text-[#94A3B8]">
                          {inr(c.total)} · {pct.toFixed(1)}%
                        </span>
                      </button>
                      {openCat === c.id && c.children.length > 0 && (
                        <div className="ml-6 mb-2 space-y-1 border-l border-[#263449] pl-3">
                          {c.children.map((ch) => (
                            <div key={ch.id} className="flex justify-between text-xs text-[#94A3B8]">
                              <span>{ch.name}</span>
                              <span className="tabular-nums">{inr(ch.total)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Spending trend">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={report.trend}>
                <defs>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#263449" vertical={false} />
                <XAxis dataKey="period" tickFormatter={shortPeriod} stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} width={50} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={fmtTip}
                />
                <Area type="monotone" dataKey="income" stroke="#22C55E" fill="url(#gInc)" />
                <Area type="monotone" dataKey="expense" stroke="#EF4444" fill="url(#gExp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Family Support">
          <div className="grid grid-cols-3 gap-3 mb-3 text-center">
            <div className="rounded-xl bg-[#0f1829] p-3">
              <p className="text-[11px] text-[#94A3B8]">Received</p>
              <p className="text-lg font-semibold text-[#22C55E]">{inr(k.familyIn)}</p>
            </div>
            <div className="rounded-xl bg-[#0f1829] p-3">
              <p className="text-[11px] text-[#94A3B8]">Given</p>
              <p className="text-lg font-semibold text-[#F59E0B]">{inr(k.familyOut)}</p>
            </div>
            <div className="rounded-xl bg-[#0f1829] p-3">
              <p className="text-[11px] text-[#94A3B8]">Net</p>
              <p className={`text-lg font-semibold ${k.netFamily >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                {inr(k.netFamily)}
              </p>
            </div>
          </div>
          <div className="h-[170px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.trend}>
                <CartesianGrid stroke="#263449" vertical={false} />
                <XAxis dataKey="period" tickFormatter={shortPeriod} stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} width={50} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={fmtTip}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <RBar dataKey="familyIn" name="Received" fill="#22C55E" radius={[4, 4, 0, 0]} />
                <RBar dataKey="familyOut" name="Given" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-[#94A3B8]">
            Family support is tracked separately and never changes the salary-based budget base.
          </p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Largest expenses">
          {report.topExpenses.length === 0 ? (
            <Empty text="Nothing recorded yet." />
          ) : (
            <ol className="space-y-2">
              {report.topExpenses.map((t, i) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-3">
                    <span className="text-[#94A3B8] w-4">{i + 1}.</span>
                    <span>
                      {t.description || t.category}
                      <span className="block text-[11px] text-[#94A3B8]">
                        {t.category} · {t.date}
                      </span>
                    </span>
                  </span>
                  <span className="tabular-nums text-[#EF4444]">{inr(t.amount)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="Insights & alerts">
          {report.alerts.length === 0 ? (
            <Empty text="No observations for this period." />
          ) : (
            <ul className="space-y-2">
              {report.alerts.map((a, i) => (
                <li
                  key={i}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    a.level === "danger"
                      ? "border-[#EF4444]/40 bg-[#EF4444]/10 animate-glow"
                      : a.level === "warning"
                        ? "border-[#F59E0B]/40 bg-[#F59E0B]/10"
                        : a.level === "success"
                          ? "border-[#22C55E]/40 bg-[#22C55E]/10"
                          : "border-[#263449] bg-[#0f1829]"
                  }`}
                >
                  {a.text}
                </li>
              ))}
            </ul>
          )}
          {report.limits.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="text-xs uppercase tracking-wide text-[#94A3B8]">Configured limits</p>
              {report.limits.map((l) => (
                <div key={l.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{l.name}</span>
                    <span className="tabular-nums text-[#94A3B8]">
                      {inr(l.spent)} / {inr(l.limit)} ({l.pct.toFixed(0)}%)
                    </span>
                  </div>
                  <Bar pct={l.pct} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Net position">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-[#94A3B8]">Assets</p>
            <p className="text-lg font-semibold text-[#22C55E]">{inr(report.balanceSheet.assets)}</p>
          </div>
          <div>
            <p className="text-xs text-[#94A3B8]">Liabilities</p>
            <p className="text-lg font-semibold text-[#EF4444]">{inr(report.balanceSheet.liabilities)}</p>
          </div>
          <div>
            <p className="text-xs text-[#94A3B8]">Net</p>
            <p className="text-lg font-semibold">{inr(report.balanceSheet.net)}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function PendingRule({
  rule,
  period,
  onDone,
}: {
  rule: Rule;
  period: string;
  onDone: () => void;
}) {
  const isLoanInterest = rule.kind === "loan_interest";
  const [amount, setAmount] = useState(
    isLoanInterest ? String(rule.suggestedAmount ?? "") : (rule.amount ?? ""),
  );
  const [busy, setBusy] = useState(false);

  async function act(action: "confirm" | "skip") {
    setBusy(true);
    await api(`/api/rules/${rule.id}/confirm`, {
      method: "POST",
      json: { action, amount: Number(amount), period, date: today() },
    }).catch(() => {});
    setBusy(false);
    onDone();
  }

  return (
    <div className="card p-4 flex flex-wrap items-center gap-3 border-[#38BDF8]/40">
      <div className="flex-1 min-w-[180px]">
        <p className="text-sm font-medium">
          {rule.kind === "salary"
            ? "Salary expected"
            : isLoanInterest
              ? `Loan interest due · ${rule.ratePct ?? 0}% this month`
              : "Bank interest expected"}{" "}
          · {rule.label || "—"}
        </p>
        <p className="text-[11px] text-[#94A3B8]">
          {isLoanInterest
            ? `Suggested from the current balance — the exact figure moves with what you owe, confirm or edit before it's added to the loan.`
            : `Day ${rule.dayOfMonth} of ${period} — confirm the actual amount received.`}
        </p>
      </div>
      <input
        className="input w-32"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button className="btn btn-primary text-xs" disabled={busy} onClick={() => act("confirm")}>
        {isLoanInterest ? "Confirm & add to loan" : "Confirm received"}
      </button>
      <button className="btn btn-ghost text-xs" disabled={busy} onClick={() => act("skip")}>
        {isLoanInterest ? "Skip this month" : "Not received"}
      </button>
    </div>
  );
}
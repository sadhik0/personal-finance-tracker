"use client";

import { useState } from "react";
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
import { inr, shortPeriod } from "@/frontend/lib/client";
import DashboardPeriodFilter from "@/frontend/components/DashboardPeriodFilter";
import InfoPopover from "@/frontend/components/InfoPopover";
import { dashboardPeriodLabel, type DashboardPeriod } from "@/shared/dashboardPeriods";
import { useApiResource } from "@/frontend/lib/apiCache";
import { useTxSaved } from "@/frontend/lib/useTxSaved";
import { DashboardSkeleton } from "@/frontend/components/Skeleton";
import { Bar, Card, CHART_COLORS, Empty, KPI, fmtTip, TOOLTIP_STYLE, type Report } from "@/frontend/components/ui";

export default function DashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>({ kind: "all", key: "all" });
  const [weeks, setWeeks] = useState(1);
  const [openCat, setOpenCat] = useState<string | null>(null);

  // Reload when a transaction is saved or finishes syncing.
  const saved = useTxSaved();
  const reportUrl = period.kind === "all" ? "/api/report?kind=all" : `/api/report?kind=${period.kind}&key=${encodeURIComponent(period.key)}${period.kind === "week" ? `&weeks=${weeks}` : ""}`;
  const { data: report, loading, error: offline } = useApiResource<Report>(reportUrl, saved);

  if (!report)
    return offline ? (
      <div className="py-20 text-center text-[#94A3B8]">
        Can&apos;t load the dashboard right now. It will refresh when you are back online.
      </div>
    ) : (
      <DashboardSkeleton />
    );

  const k = report.kpi;
  return (
    <div className={`space-y-5 ${loading ? "refreshing" : ""}`}>
      <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold">Dashboard</h1>
          <p className="text-sm text-[#94A3B8]">{dashboardPeriodLabel(period, weeks)}{offline ? " · offline, numbers may be out of date" : ""}</p>
        </div>
        <div className="w-full min-w-0 sm:ml-auto sm:w-auto sm:max-w-[70%]"><DashboardPeriodFilter value={period} weeks={weeks} onChange={setPeriod} onWeeksChange={setWeeks} /></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Income" value={k.income} tone="pos" icon="↓" sub={`Interest ${inr(k.interest)}`} />
        <KPI label="Expenses" value={k.expense} tone="neg" icon="↑" />
        <KPI
          label="Savings"
          value={k.savings}
          tone="accent"
          icon="◆"
          sub={`Savings rate ${k.savingsRate.toFixed(1)}%`}
          help={<InfoPopover label="Explain savings calculation"><strong className="text-[#F8FAFC]">Savings calculation</strong><br />{inr(k.income)} in-hand income<br />+ {inr(k.interest)} bank interest<br />− {inr(k.expense)} expenses<br />− {inr(k.familyOut)} family support given<br />− {inr(k.loanPayment)} loan repayments<br /><strong className="text-[#22C55E]">= {inr(k.savings)} savings</strong><br /><span className="text-[#94A3B8]">Family received and investments are tracked separately.</span></InfoPopover>}
        />
        <KPI
          label="Net Cash Flow"
          value={k.netCashFlow}
          tone={k.netCashFlow >= 0 ? "pos" : "neg"}
          icon="⇄"
          help={<InfoPopover label="Explain net cash flow"><strong className="text-[#F8FAFC]">Net cash flow</strong><br />{inr(k.income)} income + {inr(k.interest)} interest + {inr(k.familyIn)} family received<br />− {inr(k.expense)} expenses − {inr(k.familyOut)} family given<br />− {inr(k.loanPayment)} loan repayments − {inr(k.investment)} investments<br /><strong className="text-[#22C55E]">= {inr(k.netCashFlow)} net cash flow</strong><br /><span className="text-[#94A3B8]">This is period movement, not current bank balance.</span></InfoPopover>}
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
        <Card
          title="Budget"
          right={
            <span className="text-xs text-[#94A3B8]">
              {report.budget.frameworkLabel} · Base {inr(report.budget.base)}
            </span>
          }
        >
          {report.budget.mixed && <p className="-mt-2 mb-3 text-xs text-[#94A3B8]">Plan varies during this period · Targets are calculated month by month.</p>}
          {report.budget.base === 0 ? (
            <Empty text="No salary recorded in this period. The budget appears once you add a salary (income) transaction." />
          ) : (
            <div className="space-y-4">
              {report.budget.buckets.map((b) => {
                const isGoal = b.kind === "goal";
                const tone = isGoal ? (b.progressPct >= 100 ? "#22C55E" : "#8B5CF6") : undefined;
                return (
                  <div key={b.key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>
                        {b.label} <span className="text-[#94A3B8] text-xs">{b.pct}%</span>
                      </span>
                      <span className="tabular-nums text-[#94A3B8]">
                        {inr(b.actual)} / {inr(b.target)}
                      </span>
                    </div>
                    <Bar pct={b.progressPct} tone={tone} />
                    <p className="mt-1 text-[11px] text-[#94A3B8]">
                      {b.progressPct.toFixed(b.progressPct >= 100 ? 0 : 1)}% {isGoal ? "achieved" : "used"}
                    </p>
                  </div>
                );
              })}
              <p className="text-xs text-[#94A3B8]">
                Actual behaviour: {report.budget.buckets.map((b) => b.actualPct.toFixed(0)).join(" / ")} — the plan is a
                reference, not a rule. Change it in Settings.
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
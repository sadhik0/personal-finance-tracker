"use client";

import { useEffect, useState } from "react";
import { useTxSaved } from "@/frontend/lib/useTxSaved";
import {
  Bar as RBar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, currentPeriod, inr, monthBounds, shortDay, shortPeriod } from "@/frontend/lib/client";
import { Card, CHART_COLORS, Empty, fmtTip, TOOLTIP_STYLE, type Report } from "@/frontend/components/ui";

const RANGES = [
  { label: "1W", days: 7 },
  { label: "2W", days: 14 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState(currentPeriod());
  const [presetDays, setPresetDays] = useState(180);
  const [customOn, setCustomOn] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [report, setReport] = useState<Report | null>(null);

  const bounds = monthBounds(period);
  const rangeEnd = customOn ? customEnd || bounds.end : bounds.end;
  const rangeStart = customOn
    ? customStart || bounds.start
    : (() => {
        const d = new Date(`${bounds.end}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() - (presetDays - 1));
        return d.toISOString().slice(0, 10);
      })();

  function openCustom() {
    setCustomStart(bounds.start);
    setCustomEnd(bounds.end);
    setCustomOn(true);
  }

  const saved = useTxSaved();
  useEffect(() => {
    let alive = true;
    api<Report>(`/api/report?period=${period}&start=${rangeStart}&end=${rangeEnd}`)
      .then((r) => alive && setReport(r))
      .catch(() => {}); // offline: keep what is on screen
    return () => {
      alive = false;
    };
  }, [period, rangeStart, rangeEnd, saved]);

  if (!report) return <div className="py-20 text-center text-[#94A3B8] animate-pulse">Loading analytics…</div>;

  const dayMode = report.range.trendGranularity === "day";
  const trendTick = dayMode ? shortDay : shortPeriod;

  const savingsSeries = report.trend.map((t) => ({
    period: t.period,
    rate: t.income ? Math.round(((t.income - t.expense) / t.income) * 1000) / 10 : 0,
  }));

  const budgetVsActual = report.categories.slice(0, 8).map((c) => {
    const lim = report.limits.find((l) => l.id === c.id);
    return { name: c.name, actual: c.total, budget: lim?.limit ?? 0 };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold">Analytics</h1>
          <p className="text-sm text-[#94A3B8]">Trends, comparisons and behaviour analysis</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            className="input w-[150px]"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              setCustomOn(false);
            }}
          />
          <div className="flex rounded-lg border border-[#263449] overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => {
                  setPresetDays(r.days);
                  setCustomOn(false);
                }}
                className={`px-2.5 py-1.5 text-[11px] ${
                  !customOn && presetDays === r.days ? "bg-[#172033] text-[#38BDF8]" : "text-[#94A3B8]"
                }`}
              >
                {r.label}
              </button>
            ))}
            <button
              onClick={openCustom}
              className={`px-2.5 py-1.5 text-[11px] border-l border-[#263449] ${
                customOn ? "bg-[#172033] text-[#38BDF8]" : "text-[#94A3B8]"
              }`}
            >
              Custom
            </button>
          </div>
          {customOn && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="input w-[135px] text-xs"
                value={customStart}
                min={bounds.start}
                max={customEnd || bounds.end}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <span className="text-xs text-[#94A3B8]">to</span>
              <input
                type="date"
                className="input w-[135px] text-xs"
                value={customEnd}
                min={customStart || bounds.start}
                max={bounds.end}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Income vs expenses">
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.trend}>
                <CartesianGrid stroke="#263449" vertical={false} />
                <XAxis dataKey="period" tickFormatter={shortPeriod} stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} width={55} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={fmtTip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <RBar dataKey="income" name="Income" fill="#22C55E" radius={[4, 4, 0, 0]} />
                <RBar dataKey="expense" name="Expense" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Savings rate (%)">
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={savingsSeries}>
                <CartesianGrid stroke="#263449" vertical={false} />
                <XAxis dataKey="period" tickFormatter={shortPeriod} stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} width={45} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="rate" stroke="#38BDF8" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Category analysis (selected month)">
          {report.categories.length === 0 ? (
            <Empty text="No expenses." />
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.categories} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid stroke="#263449" horizontal={false} />
                  <XAxis type="number" stroke="#94A3B8" fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke="#94A3B8" fontSize={11} width={90} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={fmtTip} />
                  <RBar dataKey="total" radius={[0, 4, 4, 0]}>
                    {report.categories.map((c, i) => (
                      <Cell key={c.id} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </RBar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Budget vs actual">
          {report.limits.length === 0 ? (
            <Empty text="No personal limits configured yet. Add them in Settings → Limits once you know your real numbers." />
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetVsActual} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid stroke="#263449" horizontal={false} />
                  <XAxis type="number" stroke="#94A3B8" fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke="#94A3B8" fontSize={11} width={90} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={fmtTip} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <RBar dataKey="budget" name="Budget" fill="#38BDF8" radius={[0, 4, 4, 0]} />
                  <RBar dataKey="actual" name="Actual" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Family support analysis">
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={report.trend}>
                <CartesianGrid stroke="#263449" vertical={false} />
                <XAxis dataKey="period" tickFormatter={shortPeriod} stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} width={55} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={fmtTip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="familyIn" name="Received" stroke="#22C55E" strokeWidth={2} />
                <Line type="monotone" dataKey="familyOut" name="Given" stroke="#F59E0B" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Investments, loan payments & cash flow">
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.trend}>
                <CartesianGrid stroke="#263449" vertical={false} />
                <XAxis dataKey="period" tickFormatter={shortPeriod} stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} width={55} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={fmtTip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <RBar dataKey="investment" name="Investment" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                <RBar dataKey="loanPayment" name="Loan payment" fill="#EF4444" radius={[4, 4, 0, 0]} />
                <RBar dataKey="net" name="Net cash flow" fill="#38BDF8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Savings analysis">
        <div className="grid sm:grid-cols-4 gap-3 text-center">
          <Stat label="Budget base (salary)" value={inr(report.budget.base)} />
          <Stat label="Savings target" value={inr(report.budget.targets.savings)} />
          <Stat label="Actual savings" value={inr(report.kpi.savings)} tone="#22C55E" />
          <Stat
            label="Achievement"
            value={`${report.budget.targets.savings ? Math.round((report.kpi.savings / report.budget.targets.savings) * 100) : 0}%`}
            tone="#38BDF8"
          />
        </div>
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          <Stat label="Investment contribution" value={inr(report.kpi.investment)} tone="#8B5CF6" />
          <Stat label="Other savings (cash retained)" value={inr(report.kpi.savings - report.kpi.investment)} />
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-[#0f1829] p-3">
      <p className="text-[11px] text-[#94A3B8]">{label}</p>
      <p className="text-lg font-semibold tabular-nums" style={tone ? { color: tone } : undefined}>
        {value}
      </p>
    </div>
  );
}
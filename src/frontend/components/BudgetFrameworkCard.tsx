"use client";

import { useState } from "react";
import { api, currentPeriod } from "@/frontend/lib/client";
import { Card } from "@/frontend/components/ui";
import {
  BUCKET_KEYS,
  BUCKET_LABELS,
  FRAMEWORK_LABELS,
  PRESETS,
  allocationTotal,
  legacyPlan,
  planForMonth,
  validateAllocation,
  type Allocation,
  type Framework,
  type PlanEntry,
} from "@/shared/budget";

export type PlanSettings = {
  needsPct?: unknown;
  wantsPct?: unknown;
  savingsPct?: unknown;
  customNeedsPct?: unknown;
  customWantsPct?: unknown;
  customSavingsPct?: unknown;
  planHistory?: { from: string; framework: Framework; needs: number; wants: number; loan: number; savings: number }[];
};

const fmt = (a: Allocation) =>
  BUCKET_KEYS.filter((k) => a[k] > 0)
    .map((k) => `${BUCKET_LABELS[k]} ${a[k]}%`)
    .join(" · ");

export default function BudgetFrameworkCard({
  settings,
  onSaved,
}: {
  settings: PlanSettings;
  onSaved: (message: string) => void;
}) {
  const history: PlanEntry[] = (settings.planHistory ?? []).map((e) => ({
    from: e.from,
    framework: e.framework,
    allocation: { needs: e.needs, wants: e.wants, loan: e.loan, savings: e.savings },
  }));
  const legacy = legacyPlan(settings);
  const active = planForMonth(history, currentPeriod(), legacy);

  const [choice, setChoice] = useState<Framework>(active.framework);
  const [custom, setCustom] = useState<Record<keyof Allocation, string>>(() => ({
    needs: String(active.allocation.needs),
    wants: String(active.allocation.wants),
    loan: String(active.allocation.loan),
    savings: String(active.allocation.savings),
  }));
  const [from, setFrom] = useState(currentPeriod());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const customAlloc: Allocation = {
    needs: Number(custom.needs),
    wants: Number(custom.wants),
    loan: Number(custom.loan),
    savings: Number(custom.savings),
  };
  const customProblem = choice === "custom" ? validateAllocation(customAlloc) : null;
  const shown: Allocation = choice === "custom" ? customAlloc : PRESETS[choice];
  const total = allocationTotal(shown);

  async function save() {
    if (customProblem) return;
    setBusy(true);
    setErr(null);
    try {
      await api("/api/settings", {
        method: "PUT",
        json: { budgetPlan: { framework: choice, from, allocation: choice === "custom" ? customAlloc : undefined } },
      });
      onSaved(`${FRAMEWORK_LABELS[choice]} is now active from ${from}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save the plan");
    } finally {
      setBusy(false);
    }
  }

  const options: { key: Framework; title: string; text: string }[] = [
    { key: "standard", title: FRAMEWORK_LABELS.standard, text: fmt(PRESETS.standard) },
    { key: "loan", title: FRAMEWORK_LABELS.loan, text: fmt(PRESETS.loan) },
    { key: "custom", title: FRAMEWORK_LABELS.custom, text: "Set your own percentages" },
  ];

  return (
    <Card title="Budget framework">
      <p className="mb-3 text-xs text-[#94A3B8]">
        Only one plan is active at a time. Switching (for example when the loan is paid off) only changes the months
        from the date you choose. Earlier months keep the plan that was active back then.
      </p>

      <div className="grid sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Budget framework">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={choice === o.key}
            onClick={() => {
              setChoice(o.key);
              setErr(null);
            }}
            className={`rounded-xl border p-3 text-left transition ${
              choice === o.key ? "border-[#38BDF8] bg-[#172033]" : "border-[#263449] hover:border-[#38BDF8]/50"
            }`}
          >
            <p className="text-sm font-semibold">
              {choice === o.key ? "● " : "○ "}
              {o.title}
            </p>
            <p className="mt-1 text-xs text-[#94A3B8]">{o.text}</p>
            {active.framework === o.key && <p className="mt-2 text-[11px] text-[#22C55E]">Active now</p>}
          </button>
        ))}
      </div>

      {choice === "custom" && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BUCKET_KEYS.map((k) => (
            <div key={k}>
              <label className="label">{BUCKET_LABELS[k]} %</label>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.5"
                value={custom[k]}
                onChange={(e) => setCustom({ ...custom, [k]: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Applies from</label>
          <input type="month" className="input w-[150px]" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <p className={`text-sm tabular-nums ${Math.abs(total - 100) > 0.001 ? "text-[#F59E0B]" : "text-[#94A3B8]"}`}>
          Total {total}%
        </p>
        <button className="btn btn-primary text-sm" onClick={save} disabled={busy || !!customProblem || !from}>
          {busy ? "Saving…" : "Use This Plan"}
        </button>
      </div>

      {customProblem && <p className="mt-2 text-sm text-[#F59E0B]">⚠️ {customProblem}</p>}
      {err && <p className="mt-2 text-sm text-[#EF4444]">{err}</p>}

      {history.length > 0 && (
        <div className="mt-4 border-t border-[#263449] pt-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-[#94A3B8]">Plan history</p>
          <ul className="space-y-1 text-xs text-[#94A3B8]">
            {[...history].reverse().map((h) => (
              <li key={h.from}>
                From {h.from}: {FRAMEWORK_LABELS[h.framework]} ({fmt(h.allocation)})
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

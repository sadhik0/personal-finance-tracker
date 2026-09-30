/**
 * Budget frameworks. A "plan" is a set of bucket percentages that must total
 * exactly 100. 50/30/20 and 40/20/20/20 are just two presets of the same
 * engine, and custom plans use the same shape. Pure functions only.
 *
 * Plans are effective-dated: switching plans adds a history entry that applies
 * from a month onward, so old months keep being judged by the plan that was
 * active back then.
 */
export type BucketKey = "needs" | "wants" | "loan" | "savings";
export const BUCKET_KEYS: BucketKey[] = ["needs", "wants", "loan", "savings"];
export const BUCKET_LABELS: Record<BucketKey, string> = {
  needs: "Needs",
  wants: "Wants",
  loan: "Loan Repayment",
  savings: "Savings",
};
/** needs/wants are spending limits ("x% used"); loan/savings are goals ("x% achieved"). */
export const BUCKET_KIND: Record<BucketKey, "limit" | "goal"> = {
  needs: "limit",
  wants: "limit",
  loan: "goal",
  savings: "goal",
};

export type Allocation = Record<BucketKey, number>;
export type Framework = "standard" | "loan" | "custom";

export const FRAMEWORKS: Framework[] = ["standard", "loan", "custom"];
export const FRAMEWORK_LABELS: Record<Framework, string> = {
  standard: "Standard 50/30/20",
  loan: "Loan Repayment Plan",
  custom: "Custom plan",
};

export const PRESETS: Record<"standard" | "loan", Allocation> = {
  standard: { needs: 50, wants: 30, loan: 0, savings: 20 },
  loan: { needs: 40, wants: 20, loan: 20, savings: 20 },
};

export type PlanEntry = { from: string; framework: Framework; allocation: Allocation };

export const allocationTotal = (a: Allocation) =>
  Math.round(BUCKET_KEYS.reduce((sum, k) => sum + (Number(a[k]) || 0), 0) * 100) / 100;

/** null when valid, otherwise a message to show the user. */
export function validateAllocation(a: Allocation): string | null {
  for (const k of BUCKET_KEYS) {
    const v = a[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100)
      return `${BUCKET_LABELS[k]} must be between 0 and 100.`;
  }
  const total = allocationTotal(a);
  if (Math.abs(total - 100) > 0.001) return `Allocation must total 100% (currently ${total}%).`;
  return null;
}

/** Legacy settings (needs/wants/savings + optional custom overrides) as an allocation. */
export function legacyPlan(s: {
  needsPct?: unknown;
  wantsPct?: unknown;
  savingsPct?: unknown;
  customNeedsPct?: unknown;
  customWantsPct?: unknown;
  customSavingsPct?: unknown;
} | null): { framework: Framework; allocation: Allocation } {
  const n = (v: unknown, d: number) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? d : Number(v));
  const custom = s?.customNeedsPct != null && s.customNeedsPct !== "";
  const allocation: Allocation = {
    needs: n(custom ? s?.customNeedsPct : s?.needsPct, 50),
    wants: n(custom ? s?.customWantsPct : s?.wantsPct, 30),
    loan: 0,
    savings: n(custom ? s?.customSavingsPct : s?.savingsPct, 20),
  };
  return { framework: custom ? "custom" : "standard", allocation };
}

/** The plan in force for a given month (YYYY-MM). */
export function planForMonth(
  history: PlanEntry[],
  month: string,
  legacy: { framework: Framework; allocation: Allocation },
): { framework: Framework; allocation: Allocation } {
  let found: PlanEntry | null = null;
  for (const e of history) if (e.from <= month && (!found || e.from >= found.from)) found = e;
  return found ? { framework: found.framework, allocation: found.allocation } : legacy;
}

export type BudgetBucket = {
  key: BucketKey;
  label: string;
  kind: "limit" | "goal";
  /** effective plan % (weighted when the plan changed inside the period) */
  pct: number;
  target: number;
  actual: number;
  /** actual as % of the salary base */
  actualPct: number;
  /** actual as % of the target: "used" for limits, "achieved" for goals */
  progressPct: number;
};

export function computeBudget(input: {
  /** one entry per month in the period, with that month's salary base */
  months: { month: string; base: number }[];
  history: PlanEntry[];
  legacy: { framework: Framework; allocation: Allocation };
  actual: Record<BucketKey, number>;
  /** savings can be negative for actualPct; `actual.savings` is floored at 0 by the caller */
  savingsRaw: number;
}) {
  const { months, history, legacy, actual, savingsRaw } = input;
  const base = months.reduce((s, m) => s + m.base, 0);

  const targets: Allocation = { needs: 0, wants: 0, loan: 0, savings: 0 };
  const frameworks = new Set<Framework>();
  let lastAlloc = legacy.allocation;
  let lastFramework = legacy.framework;
  for (const m of months) {
    const plan = planForMonth(history, m.month, legacy);
    frameworks.add(plan.framework);
    lastAlloc = plan.allocation;
    lastFramework = plan.framework;
    for (const k of BUCKET_KEYS) targets[k] += (m.base * plan.allocation[k]) / 100;
  }
  if (months.length === 0) lastAlloc = planForMonth(history, "9999-12", legacy).allocation;

  const mixed = frameworks.size > 1;
  const pctOf = (k: BucketKey) => (base > 0 ? (targets[k] / base) * 100 : lastAlloc[k]);
  const round1 = (v: number) => Math.round(v * 10) / 10;

  const rawActual: Record<BucketKey, number> = { ...actual };
  const buckets: BudgetBucket[] = BUCKET_KEYS.filter((k) => pctOf(k) > 0.0001).map((k) => ({
    key: k,
    label: BUCKET_LABELS[k],
    kind: BUCKET_KIND[k],
    pct: round1(pctOf(k)),
    target: targets[k],
    actual: rawActual[k],
    actualPct: base ? ((k === "savings" ? savingsRaw : rawActual[k]) / base) * 100 : 0,
    progressPct: targets[k] ? (rawActual[k] / targets[k]) * 100 : 0,
  }));

  return {
    base,
    framework: mixed ? "mixed" : lastFramework,
    frameworkLabel: mixed ? "Mixed (plan changed during this period)" : FRAMEWORK_LABELS[lastFramework],
    mixed,
    buckets,
    targets,
    actual: rawActual,
  };
}

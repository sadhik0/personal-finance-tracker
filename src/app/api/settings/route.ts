import { connectToDatabase } from "@/backend/db/connect";
import { Settings } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";
import { InputError, num, oneOf, period, readJson, text } from "@/backend/utils/validate";
import {
  BUCKET_KEYS,
  FRAMEWORKS,
  PRESETS,
  validateAllocation,
  type Allocation,
  type Framework,
} from "@/shared/budget";
import { currentPeriod } from "@/backend/services/finance.service";

export async function GET(req: Request) {
  return withUser(req, async (user) => {
    await connectToDatabase();
    let row = await Settings.findOne({ userId: user.id });
    if (!row) row = await Settings.create({ userId: user.id });
    return ok(row);
  });
}

export async function PUT(req: Request) {
  return withUser(req, async (user) => {
    await connectToDatabase();
    const b = await readJson(req);
    const requestedTimeZone = req.headers.get("x-timezone") || "UTC";
    const timeZone = (() => { try { new Intl.DateTimeFormat("en-US", { timeZone: requestedTimeZone }); return requestedTimeZone; } catch { return "UTC"; } })();
    const patch: Record<string, unknown> = {};
    for (const key of [
      "needsPct",
      "wantsPct",
      "savingsPct",
      "customNeedsPct",
      "customWantsPct",
      "customSavingsPct",
    ] as const) {
      if (b[key] !== undefined)
        patch[key] = b[key] === null || b[key] === "" ? null : num(b[key], key, { min: 0, max: 100 });
    }
    // Switch the active budget plan. Presets use fixed percentages (the client
    // cannot change them); custom plans must total exactly 100.
    let newEntry: Record<string, unknown> | null = null;
    if (b.budgetPlan !== undefined) {
      const bp = b.budgetPlan as Record<string, unknown> | null;
      if (!bp || typeof bp !== "object" || Array.isArray(bp)) throw new InputError("budgetPlan is invalid");
      const framework = oneOf(bp.framework, "framework", FRAMEWORKS) as Framework;
      const from = bp.from ? period(bp.from, "from") : currentPeriod(timeZone);
      let allocation: Allocation;
      if (framework === "custom") {
        const a = (bp.allocation ?? {}) as Record<string, unknown>;
        allocation = { needs: 0, wants: 0, loan: 0, savings: 0 };
        for (const k of BUCKET_KEYS) allocation[k] = num(a[k] ?? 0, k, { min: 0, max: 100 });
        const problem = validateAllocation(allocation);
        if (problem) throw new InputError(problem);
      } else {
        allocation = PRESETS[framework];
      }
      newEntry = { from, framework, ...allocation };
    }

    if (b.theme !== undefined) patch.theme = oneOf(b.theme, "theme", ["dark", "light"] as const);
    if (b.currency !== undefined) patch.currency = text(b.currency, "currency", { max: 8, min: 1 });
    let row = await Settings.findOneAndUpdate(
      { userId: user.id },
      { $set: patch, $setOnInsert: { userId: user.id } },
      { new: true, upsert: true },
    );
    if (newEntry) {
      // replace an entry for the same month, keep the list sorted by month
      const history = ((row.planHistory ?? []) as Record<string, unknown>[])
        .map((e) => ({ from: e.from, framework: e.framework, needs: e.needs, wants: e.wants, loan: e.loan, savings: e.savings }))
        .filter((e) => e.from !== newEntry!.from);
      history.push(newEntry as (typeof history)[number]);
      history.sort((a, z) => String(a.from).localeCompare(String(z.from)));
      row = await Settings.findOneAndUpdate({ userId: user.id }, { $set: { planHistory: history } }, { new: true });
    }
    return ok(row);
  });
}

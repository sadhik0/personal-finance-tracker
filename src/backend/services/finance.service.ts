import { connectToDatabase } from "@/backend/db/connect";
import { Account, Category, Settings, Transaction } from "@/backend/models";

export const TX_TYPES = [
  "income",
  "expense",
  "transfer",
  "investment",
  "loan_repayment",
  "family_in",
  "family_out",
  "interest",
  "pf",
  "loan_interest_accrual",
] as const;
export type TxType = (typeof TX_TYPES)[number];

export const TX_LABELS: Record<TxType, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
  investment: "Investment",
  loan_repayment: "Loan Repayment",
  family_in: "Family Support Received",
  family_out: "Family Support Given",
  interest: "Bank Interest",
  pf: "PF Contribution",
  loan_interest_accrual: "Loan Interest Accrual",
};

export const num = (v: unknown) => Number(v ?? 0) || 0;

export function monthRange(period: string) {
  // period = YYYY-MM
  const [y, m] = period.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { start: iso(start), end: iso(end) };
}

export const iso = (d: Date) => d.toISOString().slice(0, 10);

export function currentPeriod(timeZone = "UTC") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

export function shiftPeriod(period: string, delta: number) {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

export function daysBetween(a: string, b: string) {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((db - da) / 86400000);
}

// Types below describe the plain JSON shape documents take after `.toJSON()`
// (string `id`, string ObjectId reference fields) — see backend/models/toJSON.ts.
export type PlainAccount = {
  id: string;
  name: string;
  kind: string;
  openingBalance: number;
  archived: boolean;
  sortOrder: number;
};
export type PlainCategory = {
  id: string;
  name: string;
  parentId: string | null;
  bucket: string;
  type: string;
  disabled: boolean;
  limitMode: string | null;
  limitValue: number | null;
};
export type Tx = {
  id: string;
  type: string;
  amount: number;
  date: string;
  categoryId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  description: string;
  meta: Record<string, unknown> | null;
};

export async function loadContext(userId: string) {
  await connectToDatabase();
  const [accs, cats, settingsDoc] = await Promise.all([
    Account.find({ userId }),
    Category.find({ userId }),
    Settings.findOne({ userId }),
  ]);
  return {
    accounts: accs.map((a) => a.toJSON()) as PlainAccount[],
    categories: cats.map((c) => c.toJSON()) as PlainCategory[],
    settings: settingsDoc ? settingsDoc.toJSON() : null,
  };
}

export async function txInRange(userId: string, start: string, end: string) {
  await connectToDatabase();
  const rows = await Transaction.find({ userId, deletedAt: null, date: { $gte: start, $lte: end } });
  return rows.map((r) => r.toJSON()) as Tx[];
}

export function summarize(txs: Tx[]) {
  const s = {
    income: 0,
    interest: 0,
    expense: 0,
    investment: 0,
    loanPayment: 0,
    familyIn: 0,
    familyOut: 0,
    pfEmployee: 0,
    pfEmployer: 0,
    transfers: 0,
    loanInterestAccrued: 0,
  };
  for (const t of txs) {
    const a = num(t.amount);
    switch (t.type as TxType) {
      case "income":
        s.income += a;
        break;
      case "interest":
        s.interest += a;
        break;
      case "expense":
        s.expense += a;
        break;
      case "investment":
        s.investment += a;
        break;
      case "loan_repayment":
        s.loanPayment += a;
        break;
      case "family_in":
        s.familyIn += a;
        break;
      case "family_out":
        s.familyOut += a;
        break;
      case "transfer":
        s.transfers += a;
        break;
      case "loan_interest_accrual":
        // Non-cash: grows the loan balance, does not touch any cash account.
        s.loanInterestAccrued += a;
        break;
      case "pf": {
        const meta = (t.meta ?? {}) as { share?: string };
        if (meta.share === "employer") s.pfEmployer += a;
        else s.pfEmployee += a;
        break;
      }
    }
  }
  const cashIn = s.income + s.interest + s.familyIn;
  const cashOut = s.expense + s.familyOut + s.loanPayment + s.investment;
  return {
    ...s,
    cashIn,
    cashOut,
    netCashFlow: cashIn - cashOut,
    savings: s.income + s.interest - s.expense - s.familyOut - s.loanPayment,
    netFamily: s.familyIn - s.familyOut,
  };
}

export function accountBalances(accs: { id: string; openingBalance: unknown }[], txs: Tx[]) {
  const map = new Map<string, number>();
  for (const a of accs) map.set(a.id, num(a.openingBalance));
  const add = (id: string | null, v: number) => {
    if (id == null) return;
    map.set(id, (map.get(id) ?? 0) + v);
  };
  for (const t of txs) {
    const a = num(t.amount);
    switch (t.type as TxType) {
      case "income":
      case "interest":
      case "family_in":
        add(t.accountId, a);
        break;
      case "expense":
      case "family_out":
        add(t.accountId, -a);
        break;
      case "transfer":
      case "investment":
      case "loan_repayment":
        add(t.accountId, -a);
        add(t.toAccountId, a);
        break;
      case "pf":
        add(t.toAccountId ?? t.accountId, a);
        break;
      case "loan_interest_accrual":
        // Interest accrues onto the loan account itself, no source account involved.
        add(t.toAccountId, -a);
        break;
    }
  }
  return map;
}

export function categorySpending(
  txs: Tx[],
  cats: { id: string; name: string; parentId: string | null; bucket: string }[],
) {
  const byId = new Map(cats.map((c) => [c.id, c]));
  const groups = new Map<
    string,
    { id: string; name: string; total: number; children: { id: string; name: string; total: number }[] }
  >();
  let uncategorized = 0;
  for (const t of txs) {
    if (t.type !== "expense") continue;
    const amt = num(t.amount);
    const cat = t.categoryId ? byId.get(t.categoryId) : undefined;
    if (!cat) {
      uncategorized += amt;
      continue;
    }
    const parent = cat.parentId ? byId.get(cat.parentId) ?? cat : cat;
    let g = groups.get(parent.id);
    if (!g) {
      g = { id: parent.id, name: parent.name, total: 0, children: [] };
      groups.set(parent.id, g);
    }
    g.total += amt;
    if (cat.id !== parent.id) {
      const child = g.children.find((c) => c.id === cat.id);
      if (child) child.total += amt;
      else g.children.push({ id: cat.id, name: cat.name, total: amt });
    }
  }
  const list = [...groups.values()].sort((a, b) => b.total - a.total);
  list.forEach((g) => g.children.sort((a, b) => b.total - a.total));
  if (uncategorized > 0)
    list.push({ id: "uncategorized", name: "Uncategorized", total: uncategorized, children: [] });
  return list;
}

export function bucketTotals(
  txs: Tx[],
  cats: { id: string; parentId: string | null; bucket: string }[],
) {
  const byId = new Map(cats.map((c) => [c.id, c]));
  let needs = 0;
  let wants = 0;
  for (const t of txs) {
    if (t.type !== "expense") continue;
    const cat = t.categoryId ? byId.get(t.categoryId) : undefined;
    const bucket =
      cat?.bucket ?? (cat?.parentId ? byId.get(cat.parentId)?.bucket : undefined) ?? "needs";
    if (bucket === "wants") wants += num(t.amount);
    else needs += num(t.amount);
  }
  return { needs, wants };
}
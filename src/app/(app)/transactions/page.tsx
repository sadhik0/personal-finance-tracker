"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, currentPeriod, inr } from "@/frontend/lib/client";
import TxForm, { TYPES, type Account, type Category, type TxRecord } from "@/frontend/components/TxForm";
import { Card, Empty, Toast } from "@/frontend/components/ui";

type Tx = TxRecord & { id: string };

function monthBounds(period: string) {
  const [y, m] = period.split("-").map(Number);
  const end = new Date(y, m, 0);
  return {
    from: `${period}-01`,
    to: `${period}-${String(end.getDate()).padStart(2, "0")}`,
  };
}

export default function TransactionsPage() {
  const [period, setPeriod] = useState(currentPeriod());
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Tx[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Tx | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { from, to } = monthBounds(period);
    const params = new URLSearchParams({ from, to });
    if (type) params.set("type", type);
    if (q) params.set("q", q);
    const [t, a, c] = await Promise.all([
      api<Tx[]>(`/api/transactions?${params}`),
      api<Account[]>("/api/accounts"),
      api<Category[]>("/api/categories"),
    ]);
    setRows(t);
    setAccounts(a);
    setCategories(c);
  }, [period, type, q]);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("tx-saved", h);
    return () => window.removeEventListener("tx-saved", h);
  }, [load]);

  const accName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const total = rows.reduce((acc, r) => acc + Number(r.amount), 0);

  async function remove(id: string) {
    await api(`/api/transactions/${id}`, { method: "DELETE" });
    setToast("Transaction deleted");
    setTimeout(() => setToast(null), 1800);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold">Transactions</h1>
          <p className="text-sm text-[#94A3B8]">
            {rows.length} records · total {inr(total)}
          </p>
        </div>
      </div>

      <Card>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Period</label>
            <input type="month" className="input" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Search</label>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Description" />
          </div>
        </div>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <Empty text="No transactions for these filters." />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-[#94A3B8]">
                  <tr>
                    <th className="py-2">Date</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Account</th>
                    <th>Description</th>
                    <th className="text-right">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-[#263449]">
                      <td className="py-2 whitespace-nowrap">{r.date}</td>
                      <td>{TYPES.find((t) => t.value === r.type)?.label ?? r.type}</td>
                      <td>{r.categoryId ? catName.get(r.categoryId) ?? "—" : "—"}</td>
                      <td className="whitespace-nowrap">
                        {r.accountId ? accName.get(r.accountId) : "—"}
                        {r.toAccountId ? ` → ${accName.get(r.toAccountId)}` : ""}
                      </td>
                      <td className="max-w-[220px] truncate">{r.description}</td>
                      <td className={`text-right tabular-nums ${amountTone(r.type)}`}>
                        {inr(Number(r.amount))}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button className="text-xs text-[#38BDF8] px-2" onClick={() => setEditing(r)}>
                          Edit
                        </button>
                        <button className="text-xs text-[#EF4444] px-1" onClick={() => remove(r.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile list */}
            <div className="md:hidden divide-y divide-[#263449]">
              {rows.map((r) => (
                <div key={r.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {r.description || TYPES.find((t) => t.value === r.type)?.label}
                    </p>
                    <p className="text-[11px] text-[#94A3B8]">
                      {r.date} · {r.categoryId ? catName.get(r.categoryId) : TYPES.find((t) => t.value === r.type)?.label}
                    </p>
                    <div className="mt-1 flex gap-3">
                      <button className="text-[11px] text-[#38BDF8]" onClick={() => setEditing(r)}>
                        Edit
                      </button>
                      <button className="text-[11px] text-[#EF4444]" onClick={() => remove(r.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                  <span className={`tabular-nums text-sm ${amountTone(r.type)}`}>
                    {inr(Number(r.amount))}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-[#263449] bg-[#111827] p-5 max-h-[92vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit transaction</h3>
              <button className="text-[#94A3B8]" onClick={() => setEditing(null)}>
                ✕
              </button>
            </div>
            <TxForm
              initial={editing}
              onCancel={() => setEditing(null)}
              onSaved={(m) => {
                setEditing(null);
                setToast(m);
                setTimeout(() => setToast(null), 1800);
                load();
              }}
            />
          </div>
        </div>
      )}
      <Toast message={toast} />
    </div>
  );
}

function amountTone(type: string) {
  if (["income", "interest", "family_in"].includes(type)) return "text-[#22C55E]";
  if (["expense", "family_out", "loan_repayment"].includes(type)) return "text-[#EF4444]";
  if (type === "investment" || type === "pf") return "text-[#8B5CF6]";
  return "text-[#38BDF8]";
}

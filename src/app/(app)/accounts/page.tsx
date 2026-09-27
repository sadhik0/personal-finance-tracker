"use client";

import { useCallback, useEffect, useState } from "react";
import { api, inr } from "@/frontend/lib/client";
import { Card, Empty, Toast } from "@/frontend/components/ui";
import { TYPES, type TxRecord } from "@/frontend/components/TxForm";

type Acc = {
  id: string;
  name: string;
  kind: string;
  openingBalance: string;
  balance: number;
  archived: boolean;
};

const KINDS = ["bank", "cash", "investment", "pf", "loan"];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [history, setHistory] = useState<(TxRecord & { id: string })[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("bank");
  const [opening, setOpening] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => setAccounts(await api<Acc[]>("/api/accounts")), []);
  useEffect(() => {
    load();
  }, [load]);

  async function openAccount(id: string) {
    if (open === id) return setOpen(null);
    setOpen(id);
    setHistory(await api(`/api/transactions?accountId=${id}&limit=50`));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const entered = Number(opening || 0);
    const stored = kind === "loan" ? -Math.abs(entered) : entered;
    await api("/api/accounts", {
      method: "POST",
      json: { name, kind, openingBalance: stored },
    });
    setName("");
    setOpening("");
    setToast("Account added");
    setTimeout(() => setToast(null), 1800);
    load();
  }

  async function saveOpening(a: Acc, value: string) {
    const entered = Number(value || 0);
    const stored = a.kind === "loan" ? -Math.abs(entered) : entered;
    await api(`/api/accounts/${a.id}`, { method: "PUT", json: { openingBalance: stored } });
    load();
  }

  const assets = accounts.filter((a) => a.kind !== "loan").reduce((s, a) => s + a.balance, 0);
  const liab = accounts
    .filter((a) => a.kind === "loan")
    .reduce((s, a) => s + Math.abs(Math.min(a.balance, 0)), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold">Accounts</h1>
        <p className="text-sm text-[#94A3B8]">
          Assets {inr(assets)} · Liabilities {inr(liab)} · Net {inr(assets - liab)}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {accounts.map((a) => (
          <div key={a.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{a.name}</p>
                <p className="text-[11px] uppercase tracking-wide text-[#94A3B8]">{a.kind}</p>
              </div>
              <span
                className={`text-lg font-semibold tabular-nums ${
                  a.kind === "loan" || a.balance < 0 ? "text-[#EF4444]" : "text-[#22C55E]"
                }`}
              >
                {inr(a.balance)}
              </span>
            </div>
            <div className="mt-3">
              <label className="label">
                {a.kind === "loan" ? "Amount currently owed (₹)" : "Opening balance (₹)"}
              </label>
              <div className="flex items-center gap-2">
                <input
                  className="input text-xs"
                  defaultValue={
                    a.kind === "loan" ? Math.abs(Number(a.openingBalance)) : Number(a.openingBalance)
                  }
                  onBlur={(e) => saveOpening(a, e.target.value)}
                />
                <button className="btn btn-ghost text-xs whitespace-nowrap" onClick={() => openAccount(a.id)}>
                  {open === a.id ? "Hide" : "History"}
                </button>
              </div>
              <p className="mt-1 text-[10px] text-[#94A3B8]">
                {a.kind === "loan"
                  ? "Enter what you owe as a plain positive number — it's stored as a liability automatically."
                  : "The balance this account started at before any transactions. Editing this shifts the balance shown everywhere, it does not add a transaction."}
              </p>
            </div>
            {open === a.id && (
              <div className="mt-3 max-h-56 overflow-y-auto space-y-1 border-t border-[#263449] pt-2">
                {history.length === 0 && <Empty text="No transactions." />}
                {history.map((h) => (
                  <div key={h.id} className="flex justify-between text-xs">
                    <span className="text-[#94A3B8]">
                      {h.date} · {TYPES.find((t) => t.value === h.type)?.label}
                    </span>
                    <span className="tabular-nums">{inr(Number(h.amount))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <Card title="Add account">
        <form onSubmit={add} className="grid sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Kind</label>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">
              {kind === "loan" ? "Amount currently owed (₹)" : "Opening balance"}
            </label>
            <input className="input" value={opening} onChange={(e) => setOpening(e.target.value)} />
          </div>
          <button className="btn btn-primary">Add account</button>
        </form>
      </Card>
      <Toast message={toast} />
    </div>
  );
}
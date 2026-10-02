"use client";

import { useEffect, useMemo, useState } from "react";
import { shortDay, today } from "@/frontend/lib/client";
import { createTransaction, listAccounts, listCategories, updateTransaction } from "@/frontend/lib/offlineApi";

export type Account = { id: string; name: string; kind: string; archived?: boolean };
export type Category = {
  id: string;
  name: string;
  parentId: string | null;
  type: string;
  bucket: string;
  disabled: boolean;
};

export type TxRecord = {
  id?: string;
  type: string;
  amount: number | string;
  date: string;
  categoryId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  description: string;
  meta?: unknown;
};

export const TYPES: { value: string; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
  { value: "investment", label: "Investment" },
  { value: "loan_repayment", label: "Loan Repayment" },
  { value: "family_in", label: "Family Support Received" },
  { value: "family_out", label: "Family Support Given" },
  { value: "interest", label: "Bank Interest" },
  { value: "pf", label: "PF Contribution" },
  { value: "loan_interest_accrual", label: "Loan Interest Accrual" },
];

export default function TxForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: TxRecord;
  onSaved: (msg: string) => void;
  onCancel?: () => void;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState(initial?.type ?? "expense");
  const [amount, setAmount] = useState(String(initial?.amount ?? ""));
  const todayStr = today();
  const [date, setDate] = useState(initial?.date ?? todayStr);
  // Date is optional: it defaults to today. "Change date" reveals the picker (never future dates).
  const [customDate, setCustomDate] = useState(!!initial?.date && initial.date !== todayStr);
  // an existing entry that already sits in the future (dashboard salary/interest) keeps its own date
  const maxDate = initial?.date && initial.date > todayStr ? initial.date : todayStr;
  const [parentId, setParentId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>(
    initial?.categoryId ? String(initial.categoryId) : "",
  );
  const [accountId, setAccountId] = useState<string>(
    initial?.accountId ? String(initial.accountId) : "",
  );
  const [toAccountId, setToAccountId] = useState<string>(
    initial?.toAccountId ? String(initial.toAccountId) : "",
  );
  const [pfShare, setPfShare] = useState<string>(
    ((initial?.meta as { share?: string })?.share ?? "employee") as string,
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([listAccounts<Account>(), listCategories<Category>()]).then(
      ([a, c]) => {
        setAccounts(a.filter((x) => !x.archived || x.id === initial?.accountId || x.id === initial?.toAccountId));
        setCategories(c);
        if (!initial?.accountId) setAccountId(String(a.find((x) => x.kind === "bank")?.id ?? ""));
        if (!initial?.toAccountId && (type === "loan_interest_accrual" || type === "loan_repayment")) {
          setToAccountId(String(a.find((x) => x.kind === "loan")?.id ?? ""));
        }
        if (initial?.categoryId) {
          const cat = c.find((x) => x.id === initial.categoryId);
          if (cat?.parentId) setParentId(String(cat.parentId));
          else if (cat) setParentId(String(cat.id));
        }
      },
    );
  }, [initial?.accountId, initial?.categoryId, initial?.toAccountId, type]);

  const wantedCatType = type === "income" ? "income" : "expense";
  const parents = useMemo(
    () => categories.filter((c) => !c.parentId && !c.disabled && c.type === wantedCatType),
    [categories, wantedCatType],
  );
  const children = useMemo(
    () => categories.filter((c) => parentId && c.parentId === parentId && !c.disabled),
    [categories, parentId],
  );

  const showCategory = type === "expense" || type === "income";
  const isLoanInterest = type === "loan_interest_accrual";
  const showTo = ["transfer", "investment", "loan_repayment", "loan_interest_accrual", "pf"].includes(type);
  const showFrom = type !== "pf" && !isLoanInterest;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const amt = Number(amount);
    if (!(amt > 0)) return setError("Amount must be greater than 0");
    if (isLoanInterest && !toAccountId) return setError("Select the loan account receiving the interest");
    if (type === "loan_repayment" && (!accountId || !toAccountId)) {
      return setError("Select both the payment account and the loan being repaid");
    }
    if (date > maxDate) return setError("Date cannot be in the future");
    setBusy(true);
    try {
      const payload = {
        type,
        amount: amt,
        date,
        categoryId: showCategory ? (categoryId || parentId) || null : null,
        accountId: showFrom ? accountId || null : null,
        toAccountId: showTo ? toAccountId || null : null,
        description,
        meta: type === "pf" ? { share: pfShare } : null,
      };
      if (initial?.id) await updateTransaction(initial.id, payload);
      else await createTransaction(payload);
      onSaved(
        initial?.id
          ? "Transaction updated"
          : navigator.onLine
            ? "Transaction saved"
            : "Saved on this device — will sync when back online",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const toKindHint =
    type === "investment"
      ? "investment"
      : type === "loan_repayment" || type === "loan_interest_accrual"
        ? "loan"
        : type === "pf"
          ? "pf"
          : null;
  const toAccounts = toKindHint ? accounts.filter((a) => a.kind === toKindHint) : accounts;
  const fromAccounts = type === "loan_repayment" ? accounts.filter((a) => a.kind !== "loan") : accounts;

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">Amount</label>
        <input
          className="input text-xl font-semibold"
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Transaction type</label>
          <select
            className="input"
            value={type}
            onChange={(e) => {
              const next = e.target.value;
              setType(next);
              if ((next === "loan_interest_accrual" || next === "loan_repayment") && !toAccountId) {
                setToAccountId(String(accounts.find((a) => a.kind === "loan")?.id ?? ""));
              }
            }}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          {customDate ? (
            <div className="flex gap-2">
              <input
                type="date"
                className="input"
                value={date}
                max={maxDate}
                onChange={(e) => setDate(e.target.value || todayStr)}
              />
              {!initial?.id && (
                <button
                  type="button"
                  className="btn btn-ghost text-xs whitespace-nowrap"
                  onClick={() => {
                    setDate(todayStr);
                    setCustomDate(false);
                  }}
                >
                  Today
                </button>
              )}
            </div>
          ) : (
            <div className="input flex items-center justify-between gap-2">
              <span>Today · {shortDay(todayStr)}</span>
              <button type="button" className="text-xs text-[#38BDF8] hover:underline" onClick={() => setCustomDate(true)}>
                Change date
              </button>
            </div>
          )}
        </div>
      </div>

      {showCategory && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={parentId}
              onChange={(e) => {
                setParentId(e.target.value);
                setCategoryId("");
              }}
            >
              <option value="">Select…</option>
              {parents.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Subcategory</label>
            <select
              className="input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={!children.length}
            >
              <option value="">{children.length ? "Select…" : "None"}</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {showFrom && (
          <div>
            <label className="label">
              {type === "loan_repayment" ? "Pay from (your bank/cash)" : showTo ? "From account" : "Account"}
            </label>
            <select
              className="input"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">Select…</option>
              {fromAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {showTo && (
          <div>
            <label className="label">
              {type === "loan_repayment" || isLoanInterest ? "Loan account" : "To account"}
            </label>
            <select
              className="input"
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
            >
              <option value="">Select…</option>
              {toAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {type === "pf" && (
          <div>
            <label className="label">PF share</label>
            <select className="input" value={pfShare} onChange={(e) => setPfShare(e.target.value)}>
              <option value="employee">Employee PF</option>
              <option value="employer">Employer PF</option>
            </select>
          </div>
        )}
      </div>

      <div>
        <label className="label">Description</label>
        <input
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional note"
        />
      </div>

      {error && <p className="text-sm text-[#EF4444]">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button className="btn btn-primary flex-1" disabled={busy} type="submit">
          {busy ? "Saving…" : "Save"}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

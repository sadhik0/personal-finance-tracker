"use client";

import { useState } from "react";
import { api } from "@/frontend/lib/client";
import { getDb } from "@/frontend/lib/db";

/** "Delete all transactions", guarded by the account password. */
export default function DeleteAllTransactionsButton({ onDone }: { onDone: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function close() {
    setOpen(false);
    setPassword("");
    setError("");
  }

  async function wipe() {
    setError("");
    if (!navigator.onLine) return setError("You need an internet connection to delete all transactions.");
    setBusy(true);
    try {
      await api("/api/data", { method: "DELETE", json: { password } });
      await getDb().transactions.clear();
      await getDb().syncQueue.clear();
      close();
      onDone("All transactions deleted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the transactions");
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <button className="btn btn-ghost w-full text-[#EF4444]" onClick={() => setOpen(true)}>
        Delete all transactions
      </button>
    );

  return (
    <div className="space-y-3 rounded-xl border border-[#EF4444]/40 p-3">
      <p className="text-sm">
        This permanently deletes <b>every transaction</b> on the server and on this device. Accounts and categories
        stay. It cannot be undone. Export a backup first if you want a copy.
      </p>
      <div>
        <label className="label">Your password</label>
        <input
          type="password"
          className="input"
          value={password}
          autoComplete="current-password"
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <button className="btn btn-ghost flex-1" onClick={close} disabled={busy}>
          Cancel
        </button>
        <button className="btn btn-ghost flex-1 text-[#EF4444]" onClick={wipe} disabled={busy || !password}>
          {busy ? "Deleting…" : "Delete everything"}
        </button>
      </div>
      {error && <p className="text-sm text-[#EF4444]">{error}</p>}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "./ui";
import db from "@/frontend/lib/db";
import { fetchAllTransactions } from "@/frontend/lib/fetchAll";
import { createTransaction, listAccounts, listCategories } from "@/frontend/lib/offlineApi";
import { TYPES } from "./TxForm";

const FORMAT = "finance-tracker-backup";

type BackupTx = {
  id: string;
  updatedAt: string;
  type: string;
  amount: number;
  date: string;
  categoryId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  description: string;
  meta: unknown;
};

export default function BackupCard() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    db.settings.get("lastBackupAt").then((r) => setLast((r?.value as string) ?? null));
  }, []);

  async function exportBackup() {
    setBusy(true);
    setMsg("");
    try {
      let txs: BackupTx[];
      if (navigator.onLine) {
        txs = await fetchAllTransactions<BackupTx>();
      } else {
        const rows = await db.transactions.toArray();
        txs = rows
          .filter((r) => !r.deletedAt)
          .map((r) => ({
            id: r.serverId ?? r.clientId,
            updatedAt: r.updatedAt,
            type: r.type,
            amount: r.amount,
            date: r.date,
            categoryId: r.categoryId,
            accountId: r.accountId,
            toAccountId: r.toAccountId,
            description: r.description,
            meta: r.meta,
          }));
      }
      const [accounts, categories] = await Promise.all([listAccounts<unknown>(), listCategories<unknown>()]);
      const data = { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), transactions: txs, accounts, categories };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `FinanceTracker_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const now = new Date().toISOString();
      await db.settings.put({ key: "lastBackupAt", value: now });
      setLast(now);
      setMsg(`Exported ${txs.length} transactions.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function importBackup(file: File) {
    setBusy(true);
    setMsg("");
    try {
      if (!navigator.onLine) return setMsg("Connect to the internet to import (needed to avoid duplicates).");
      let data: { format?: string; transactions?: unknown };
      try {
        data = JSON.parse(await file.text());
      } catch {
        return setMsg("That file is not valid JSON.");
      }
      if (data.format !== FORMAT || !Array.isArray(data.transactions)) return setMsg("Not a Finance Tracker backup file.");

      const [existing, accounts, categories] = await Promise.all([
        fetchAllTransactions<{ id: string; updatedAt: string }>(),
        listAccounts<{ id: string }>(),
        listCategories<{ id: string }>(),
      ]);
      const haveIds = new Set(existing.map((t) => t.id));
      const accIds = new Set(accounts.map((a) => a.id));
      const catIds = new Set(categories.map((c) => c.id));
      const validTypes = new Set(TYPES.map((t) => t.value));

      let added = 0;
      let skipped = 0;
      for (const raw of data.transactions as Partial<BackupTx>[]) {
        const amount = Number(raw.amount);
        const valid =
          raw &&
          typeof raw.type === "string" &&
          validTypes.has(raw.type) &&
          amount > 0 &&
          typeof raw.date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(raw.date);
        if (!valid || (raw.id && haveIds.has(raw.id))) {
          skipped++;
          continue;
        }
        await createTransaction({
          type: raw.type as string,
          amount,
          date: raw.date as string,
          categoryId: raw.categoryId && catIds.has(raw.categoryId) ? raw.categoryId : null,
          accountId: raw.accountId && accIds.has(raw.accountId) ? raw.accountId : null,
          toAccountId: raw.toAccountId && accIds.has(raw.toAccountId) ? raw.toAccountId : null,
          description: String(raw.description ?? ""),
          meta: raw.meta ?? null,
        });
        added++;
      }
      window.dispatchEvent(new Event("tx-saved"));
      setMsg(`Restored ${added} transactions, skipped ${skipped} (already present or invalid).`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card title="Backup">
      <div className="space-y-3">
        <button className="btn btn-ghost w-full" disabled={busy} onClick={exportBackup}>
          Export backup (.json)
        </button>
        <button className="btn btn-ghost w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
          Restore from backup file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])}
        />
        <p className="text-xs text-[#94A3B8]">
          Last backup: {last ? new Date(last).toLocaleString("en-IN") : "never"}. Restore adds only transactions that
          are missing from this account; it never deletes anything. Accounts and categories are not recreated.
        </p>
        {msg && <p className="text-sm text-[#38BDF8]">{msg}</p>}
      </div>
    </Card>
  );
}

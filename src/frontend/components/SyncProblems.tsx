"use client";
import { useCallback, useEffect, useState } from "react";
import { listFailedSyncItems, removeFailedSyncItem, retrySyncItem, subscribeSyncStatus } from "@/frontend/lib/syncEngine";
import { Card } from "./ui";
import type { SyncQueueItem } from "@/frontend/lib/db";
export default function SyncProblems() {
  const [items, setItems] = useState<SyncQueueItem[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(() => { void listFailedSyncItems().then(setItems).catch(() => setItems([])); }, []);
  useEffect(() => { load(); return subscribeSyncStatus(load); }, [load]);
  if (!items.length) return null;
  return (
    <Card title="Offline sync problems">
      <p className="mb-3 text-xs text-[#F59E0B]">These transactions are saved on this device but were not accepted by the server.</p>
      <div className="space-y-2">
        {items.map((item) => {
          const payload = item.payload;
          return (
            <div key={item.id} className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/5 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{String(payload.description || payload.type || "Transaction")}</p>
                  <p className="text-xs text-[#94A3B8]">{payload.date ? String(payload.date) : "No date"} · ₹{Number(payload.amount ?? 0).toLocaleString("en-IN")}</p>
                  <p className="mt-1 text-xs text-[#F87171]">{item.lastError ?? "Sync failed"}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button className="btn btn-ghost text-xs" disabled={busy === item.id} onClick={async () => { setBusy(item.id ?? null); await retrySyncItem(item.id!); setBusy(null); load(); }}>Retry</button>
                  <button className="text-xs text-[#F87171] hover:underline" disabled={busy === item.id} onClick={async () => { if (!window.confirm("Remove this unsynced transaction from this device?")) return; setBusy(item.id ?? null); await removeFailedSyncItem(item.id!); setBusy(null); load(); }}>Remove</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

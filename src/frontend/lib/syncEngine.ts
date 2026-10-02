import { getActiveUserId, getDb, type SyncQueueItem } from "./db";
import { api } from "./client";
export type SyncStatus = { online: boolean; pending: number; failed: number; syncing: boolean; lastError: string | null };
let status: SyncStatus = { online: true, pending: 0, failed: 0, syncing: false, lastError: null };
const listeners = new Set<(s: SyncStatus) => void>();
function setStatus(patch: Partial<SyncStatus>) { status = { ...status, ...patch }; listeners.forEach((l) => l(status)); }
export function subscribeSyncStatus(listener: (s: SyncStatus) => void) { listeners.add(listener); listener(status); return () => { listeners.delete(listener); }; }
export function getSyncStatus() { return status; }
async function refreshCounts() { if (!getActiveUserId()) { setStatus({ pending: 0, failed: 0 }); return; } const db = getDb(); const [pending, failed] = await Promise.all([db.syncQueue.filter((q) => q.failed !== true).count(), db.syncQueue.filter((q) => q.failed === true).count()]); setStatus({ pending, failed }); }
let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
function retryLater(ms: number) { if (retryTimer || typeof window === "undefined") return; retryTimer = setTimeout(() => { retryTimer = null; if (navigator.onLine) void flushQueue(); }, ms); }
export async function flushQueue() {
  if (!getActiveUserId()) return;
  if (flushing || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  flushing = true; let appliedAny = false; setStatus({ syncing: true, lastError: null });
  try {
    const db = getDb(); const items = await db.syncQueue.orderBy("createdAt").toArray();
    for (const item of items) {
      if (item.failed) continue;
      try { await applyOne(item); await db.syncQueue.delete(item.id!); appliedAny = true; }
      catch (err) {
        const code = (err as { status?: number }).status;
        const message = err instanceof Error ? err.message : "Sync failed";
        if (err instanceof TypeError || code === 429 || (code !== undefined && code >= 500)) { setStatus({ lastError: "Offline or server busy — will retry automatically" }); retryLater(60_000); break; }
        const attempts = (item.attempts ?? 0) + 1;
        await db.syncQueue.update(item.id!, { attempts, lastError: message, failed: true });
        await db.transactions.update(item.clientId, { syncState: "failed", syncError: message, dirty: true });
        setStatus({ lastError: message });
      }
    }
  } finally {
    flushing = false; await refreshCounts(); setStatus({ syncing: false });
    if (appliedAny && typeof window !== "undefined") window.dispatchEvent(new Event("tx-saved"));
  }
}
export async function retrySyncItem(id: number) { const db = getDb(); await db.syncQueue.update(id, { failed: false, lastError: undefined }); const item = await db.syncQueue.get(id); if (item) await db.transactions.update(item.clientId, { syncState: "pending", syncError: undefined, dirty: true }); await flushQueue(); }
export async function removeFailedSyncItem(id: number) { const db = getDb(); const item = await db.syncQueue.get(id); if (!item) return; await db.syncQueue.delete(id); await db.transactions.delete(item.clientId); await refreshCounts(); }
export async function listFailedSyncItems() { return getDb().syncQueue.filter((q) => q.failed === true).toArray(); }
async function applyOne(item: SyncQueueItem) {
  const db = getDb();
  if (item.op === "create") { const row = await api<{ id: string }>("/api/transactions", { method: "POST", json: item.payload }); await db.transactions.update(item.clientId, { serverId: row.id, dirty: false, syncState: "synced", syncError: undefined }); return; }
  const local = await db.transactions.get(item.clientId);
  if (item.op === "update") { if (!local?.serverId) throw new Error("This update is waiting for its original transaction to sync"); await api(`/api/transactions/${local.serverId}`, { method: "PUT", json: item.payload }); await db.transactions.update(item.clientId, { dirty: false, syncState: "synced", syncError: undefined }); return; }
  if (item.op === "delete") { if (local?.serverId) await api(`/api/transactions/${local.serverId}`, { method: "DELETE" }); await db.transactions.delete(item.clientId); }
}
let wired = false;
export function wireSyncEngine() {
  if (wired || typeof window === "undefined") return; wired = true; setStatus({ online: navigator.onLine }); void refreshCounts();
  window.addEventListener("online", () => { setStatus({ online: true }); void flushQueue(); });
  window.addEventListener("offline", () => setStatus({ online: false }));
  window.addEventListener("session-expired", () => setStatus({ lastError: "Session expired — log in again to sync pending changes", pending: 0, failed: 0 }));
  window.addEventListener("local-user-changed", () => { setStatus({ pending: 0, failed: 0, lastError: null }); void refreshCounts(); if (navigator.onLine) void flushQueue(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && navigator.onLine) void flushQueue(); });
  if (navigator.onLine) void flushQueue();
}

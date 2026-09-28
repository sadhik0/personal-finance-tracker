import db, { type SyncQueueItem } from "./db";
import { api } from "./client";

export type SyncStatus = {
  online: boolean;
  pending: number;
  syncing: boolean;
  lastError: string | null;
};

let status: SyncStatus = { online: true, pending: 0, syncing: false, lastError: null };
const listeners = new Set<(s: SyncStatus) => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l(status));
}

export function subscribeSyncStatus(listener: (s: SyncStatus) => void) {
  listeners.add(listener);
  listener(status);
  return () => {
    listeners.delete(listener);
  };
}

export function getSyncStatus() {
  return status;
}

async function refreshPendingCount() {
  const pending = await db.syncQueue.count();
  setStatus({ pending });
}

let flushing = false;

/** Replays the queue in order. Stops at the first item that fails for a
 * *network* reason (so nothing gets skipped out of order) but drops items
 * that fail for a *validation* reason (bad data can't ever succeed by
 * retrying, and would otherwise block every later queued item forever). */
export async function flushQueue() {
  if (flushing || typeof navigator !== "undefined" && !navigator.onLine) return;
  flushing = true;
  setStatus({ syncing: true, lastError: null });
  try {
    const items = await db.syncQueue.orderBy("createdAt").toArray();
    for (const item of items) {
      try {
        await applyOne(item);
        await db.syncQueue.delete(item.id!);
      } catch (err) {
        // fetch throws TypeError when offline/unreachable. A 429 (rate limited)
        // or 5xx (server hiccup) is also temporary: keep the item and retry later.
        const status = (err as { status?: number }).status;
        const retryLater = err instanceof TypeError || status === 429 || (status !== undefined && status >= 500);
        if (retryLater) {
          setStatus({ lastError: "Offline — will retry when back online" });
          break; // stop here, keep order, try again next flush
        }
        // Validation/auth error from the server: this item can never
        // succeed by retrying as-is. Drop it so it doesn't block the rest.
        await db.syncQueue.update(item.id!, {
          attempts: (item.attempts ?? 0) + 1,
          lastError: err instanceof Error ? err.message : "Sync failed",
        });
        if ((item.attempts ?? 0) >= 3) await db.syncQueue.delete(item.id!);
        setStatus({ lastError: err instanceof Error ? err.message : "Sync failed" });
      }
    }
  } finally {
    flushing = false;
    await refreshPendingCount();
    setStatus({ syncing: false });
  }
}

async function applyOne(item: SyncQueueItem) {
  if (item.entity !== "transaction") return;
  if (item.op === "create") {
    const row = await api<{ id: string }>("/api/transactions", { method: "POST", json: item.payload });
    await db.transactions.update(item.clientId, { serverId: row.id, dirty: false });
  } else if (item.op === "update") {
    const local = await db.transactions.get(item.clientId);
    if (!local?.serverId) return; // create for this row hasn't synced yet — nothing to PUT against
    await api(`/api/transactions/${local.serverId}`, { method: "PUT", json: item.payload });
    await db.transactions.update(item.clientId, { dirty: false });
  } else if (item.op === "delete") {
    const local = await db.transactions.get(item.clientId);
    if (local?.serverId) await api(`/api/transactions/${local.serverId}`, { method: "DELETE" });
    await db.transactions.delete(item.clientId);
  }
}

let wired = false;
export function wireSyncEngine() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  setStatus({ online: navigator.onLine });
  refreshPendingCount();
  window.addEventListener("online", () => {
    setStatus({ online: true });
    flushQueue();
  });
  window.addEventListener("offline", () => setStatus({ online: false }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) flushQueue();
  });
  if (navigator.onLine) flushQueue();
}

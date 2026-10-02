import { getDb, newClientId, type LocalAccount, type LocalCategory, type LocalTx } from "./db";
import { api } from "./client";
import { flushQueue } from "./syncEngine";
export type Tx = { id: string; clientId: string; type: string; amount: number; date: string; categoryId: string | null; accountId: string | null; toAccountId: string | null; description: string; meta: unknown; dirty: boolean; syncState?: LocalTx["syncState"]; syncError?: string };
function toTx(row: LocalTx): Tx { return { id: row.serverId ?? row.clientId, clientId: row.clientId, type: row.type, amount: row.amount, date: row.date, categoryId: row.categoryId, accountId: row.accountId, toAccountId: row.toAccountId, description: row.description, meta: row.meta, dirty: row.dirty, syncState: row.syncState, syncError: row.syncError }; }
function isOnline() { return typeof navigator === "undefined" || navigator.onLine; }
export async function listTransactions(params: { from?: string; to?: string; type?: string; q?: string }): Promise<Tx[]> {
  const db = getDb();
  if (isOnline()) {
    try {
      const qs = new URLSearchParams();
      if (params.from) qs.set("from", params.from); if (params.to) qs.set("to", params.to); if (params.type) qs.set("type", params.type); if (params.q) qs.set("q", params.q);
      type ServerTx = { id: string; type: string; amount: number; date: string; categoryId: string | null; accountId: string | null; toAccountId: string | null; description: string; meta: unknown; updatedAt: string };
      const rows = await api<ServerTx[]>(`/api/transactions?${qs}`);
      const pendingClientIds = new Set((await db.syncQueue.toArray()).map((q) => q.clientId));
      const serverIds = new Set(rows.map((r) => r.id));
      await db.transaction("rw", db.transactions, async () => {
        for (const r of rows) {
          const existing = await db.transactions.where("serverId").equals(r.id).first();
          if (existing && pendingClientIds.has(existing.clientId)) continue;
          await db.transactions.put({ clientId: existing?.clientId ?? newClientId(), serverId: r.id, type: r.type, amount: r.amount, date: r.date, categoryId: r.categoryId, accountId: r.accountId, toAccountId: r.toAccountId, description: r.description, meta: r.meta, updatedAt: r.updatedAt, deletedAt: null, dirty: false, syncState: "synced", syncError: undefined });
        }
        // Only reconcile an unfiltered date-range/list request. A filtered search
        // response is not a complete server snapshot and must not delete cache rows.
        if (!params.type && !params.q && rows.length < 500) {
          const local = await db.transactions.toArray();
          for (const row of local) {
            const inRange = (!params.from || row.date >= params.from) && (!params.to || row.date <= params.to);
            if (inRange && row.serverId && !serverIds.has(row.serverId) && !pendingClientIds.has(row.clientId)) await db.transactions.delete(row.clientId);
          }
        }
      });
      return rows.map((r) => ({ id: r.id, clientId: r.id, type: r.type, amount: r.amount, date: r.date, categoryId: r.categoryId, accountId: r.accountId, toAccountId: r.toAccountId, description: r.description, meta: r.meta, dirty: pendingClientIds.has(r.id), syncState: pendingClientIds.has(r.id) ? "pending" : "synced" }));
    } catch { /* use local cache below */ }
  }
  const all = await db.transactions.toArray();
  return all.filter((r) => !r.deletedAt).filter((r) => !params.from || r.date >= params.from).filter((r) => !params.to || r.date <= params.to).filter((r) => !params.type || r.type === params.type).filter((r) => !params.q || r.description.toLowerCase().includes(params.q.toLowerCase())).sort((a, b) => (a.date < b.date ? 1 : -1)).map(toTx);
}
export async function createTransaction(payload: { type: string; amount: number; date: string; categoryId: string | null; accountId: string | null; toAccountId: string | null; description: string; meta?: unknown }): Promise<Tx> {
  const db = getDb(); const clientId = newClientId(); const now = new Date().toISOString();
  const row: LocalTx = { clientId, serverId: null, ...payload, meta: payload.meta ?? null, updatedAt: now, deletedAt: null, dirty: true, syncState: "pending" };
  await db.transactions.put(row); await db.syncQueue.add({ entity: "transaction", op: "create", clientId, payload: { ...payload, clientId }, createdAt: now, attempts: 0 });
  if (isOnline()) void flushQueue(); return toTx(row);
}
export async function updateTransaction(id: string, patch: Record<string, unknown>): Promise<void> {
  const db = getDb(); const row = (await db.transactions.get(id)) ?? (await db.transactions.where("serverId").equals(id).first()); if (!row) return;
  await db.transactions.update(row.clientId, { ...(patch as Partial<LocalTx>), updatedAt: new Date().toISOString(), dirty: true, syncState: "pending", syncError: undefined });
  const queued = await db.syncQueue.where("clientId").equals(row.clientId).and((q) => q.op === "create").first();
  if (queued) await db.syncQueue.update(queued.id!, { payload: { ...queued.payload, ...patch }, failed: false, lastError: undefined });
  else await db.syncQueue.add({ entity: "transaction", op: "update", clientId: row.clientId, payload: patch, createdAt: new Date().toISOString(), attempts: 0 });
  if (isOnline()) void flushQueue();
}
export async function deleteTransaction(id: string): Promise<void> {
  const db = getDb(); const row = (await db.transactions.get(id)) ?? (await db.transactions.where("serverId").equals(id).first()); if (!row) return;
  const queuedCreate = await db.syncQueue.where("clientId").equals(row.clientId).and((q) => q.op === "create").first();
  if (queuedCreate) { await db.syncQueue.delete(queuedCreate.id!); await db.transactions.delete(row.clientId); return; }
  await db.transactions.update(row.clientId, { deletedAt: new Date().toISOString(), dirty: true, syncState: "pending", syncError: undefined });
  await db.syncQueue.add({ entity: "transaction", op: "delete", clientId: row.clientId, payload: {}, createdAt: new Date().toISOString(), attempts: 0 });
  if (isOnline()) void flushQueue();
}
export async function listAccounts<T>(): Promise<T[]> {
  const db = getDb(); if (isOnline()) { try { const rows = await api<T[]>("/api/accounts"); await db.accounts.bulkPut(rows as unknown as LocalAccount[]); return rows; } catch { /* local */ } }
  return (await db.accounts.toArray()) as unknown as T[];
}
export async function listCategories<T>(): Promise<T[]> {
  const db = getDb(); if (isOnline()) { try { const rows = await api<T[]>("/api/categories"); await db.categories.bulkPut(rows as unknown as LocalCategory[]); return rows; } catch { /* local */ } }
  return (await db.categories.toArray()) as unknown as T[];
}

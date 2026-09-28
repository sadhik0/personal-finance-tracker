import db, { newClientId, type LocalAccount, type LocalCategory, type LocalTx } from "./db";
import { api } from "./client";
import { flushQueue } from "./syncEngine";

export type Tx = {
  id: string; // serverId if synced, else clientId — UI never needs to know which
  clientId: string;
  type: string;
  amount: number;
  date: string;
  categoryId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  description: string;
  meta: unknown;
  dirty: boolean;
};

function toTx(row: LocalTx): Tx {
  return {
    id: row.serverId ?? row.clientId,
    clientId: row.clientId,
    type: row.type,
    amount: row.amount,
    date: row.date,
    categoryId: row.categoryId,
    accountId: row.accountId,
    toAccountId: row.toAccountId,
    description: row.description,
    meta: row.meta,
    dirty: row.dirty,
  };
}

function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine;
}

export async function listTransactions(params: {
  from?: string;
  to?: string;
  type?: string;
  q?: string;
}): Promise<Tx[]> {
  if (isOnline()) {
    try {
      const qs = new URLSearchParams();
      if (params.from) qs.set("from", params.from);
      if (params.to) qs.set("to", params.to);
      if (params.type) qs.set("type", params.type);
      if (params.q) qs.set("q", params.q);
      type ServerTx = {
        id: string;
        type: string;
        amount: number;
        date: string;
        categoryId: string | null;
        accountId: string | null;
        toAccountId: string | null;
        description: string;
        meta: unknown;
        updatedAt: string;
      };
      const rows = await api<ServerTx[]>(`/api/transactions?${qs}`);
      // Mirror into the local cache so the same range is browsable offline
      // later, without clobbering anything still queued to sync out.
      const pendingClientIds = new Set((await db.syncQueue.toArray()).map((q) => q.clientId));
      await db.transaction("rw", db.transactions, async () => {
        for (const r of rows) {
          const existing = await db.transactions.where("serverId").equals(r.id).first();
          if (existing && pendingClientIds.has(existing.clientId)) continue; // local edit not yet synced — keep it
          await db.transactions.put({
            clientId: existing?.clientId ?? newClientId(),
            serverId: r.id,
            type: r.type,
            amount: r.amount,
            date: r.date,
            categoryId: r.categoryId,
            accountId: r.accountId,
            toAccountId: r.toAccountId,
            description: r.description,
            meta: r.meta,
            updatedAt: r.updatedAt,
            deletedAt: null,
            dirty: false,
          });
        }
      });
      return rows.map((r) => ({
        id: r.id,
        clientId: r.id,
        type: r.type,
        amount: r.amount,
        date: r.date,
        categoryId: r.categoryId,
        accountId: r.accountId,
        toAccountId: r.toAccountId,
        description: r.description,
        meta: r.meta,
        dirty: pendingClientIds.has(r.id),
      }));
    } catch {
      // fall through to local cache below (request itself failed)
    }
  }
  // Offline (or the request failed): best-effort filter over the local cache.
  const all = await db.transactions.toArray();
  return all
    .filter((r) => !r.deletedAt)
    .filter((r) => !params.from || r.date >= params.from)
    .filter((r) => !params.to || r.date <= params.to)
    .filter((r) => !params.type || r.type === params.type)
    .filter((r) => !params.q || r.description.toLowerCase().includes(params.q.toLowerCase()))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map(toTx);
}

export async function createTransaction(payload: {
  type: string;
  amount: number;
  date: string;
  categoryId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  description: string;
  meta?: unknown;
}): Promise<Tx> {
  const clientId = newClientId();
  const row: LocalTx = {
    clientId,
    serverId: null,
    ...payload,
    meta: payload.meta ?? null,
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    dirty: true,
  };
  await db.transactions.put(row);
  await db.syncQueue.add({
    entity: "transaction",
    op: "create",
    clientId,
    payload: { ...payload, clientId },
    createdAt: row.updatedAt,
    attempts: 0,
  });
  if (isOnline()) flushQueue(); // don't await — return optimistically, sync in background
  return toTx(row);
}

export async function updateTransaction(id: string, patch: Record<string, unknown>): Promise<void> {
  const row = (await db.transactions.get(id)) ?? (await db.transactions.where("serverId").equals(id).first());
  if (!row) return;
  await db.transactions.update(row.clientId, {
    ...(patch as Partial<LocalTx>),
    updatedAt: new Date().toISOString(),
    dirty: true,
  });
  // If the create for this row hasn't synced yet, just rewrite the queued
  // create payload instead of queuing a separate update against an id that
  // doesn't exist on the server yet.
  const queued = await db.syncQueue.where("clientId").equals(row.clientId).and((q) => q.op === "create").first();
  if (queued) {
    await db.syncQueue.update(queued.id!, { payload: { ...queued.payload, ...patch } });
  } else {
    await db.syncQueue.add({
      entity: "transaction",
      op: "update",
      clientId: row.clientId,
      payload: patch,
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
  }
  if (isOnline()) flushQueue();
}

export async function deleteTransaction(id: string): Promise<void> {
  const row = (await db.transactions.get(id)) ?? (await db.transactions.where("serverId").equals(id).first());
  if (!row) return;
  const queuedCreate = await db.syncQueue
    .where("clientId")
    .equals(row.clientId)
    .and((q) => q.op === "create")
    .first();
  if (queuedCreate) {
    // Never left the device — just drop it, nothing to tell the server.
    await db.syncQueue.delete(queuedCreate.id!);
    await db.transactions.delete(row.clientId);
    return;
  }
  await db.transactions.update(row.clientId, { deletedAt: new Date().toISOString(), dirty: true });
  await db.syncQueue.add({
    entity: "transaction",
    op: "delete",
    clientId: row.clientId,
    payload: {},
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
  if (isOnline()) flushQueue();
}

// --- Accounts / Categories / Settings: read-through cache, online-only writes ---

export async function listAccounts<T>(): Promise<T[]> {
  if (isOnline()) {
    try {
      const rows = await api<T[]>("/api/accounts");
      await db.accounts.bulkPut(rows as unknown as LocalAccount[]);
      return rows;
    } catch {
      /* fall through */
    }
  }
  return (await db.accounts.toArray()) as unknown as T[];
}

export async function listCategories<T>(): Promise<T[]> {
  if (isOnline()) {
    try {
      const rows = await api<T[]>("/api/categories");
      await db.categories.bulkPut(rows as unknown as LocalCategory[]);
      return rows;
    } catch {
      /* fall through */
    }
  }
  return (await db.categories.toArray()) as unknown as T[];
}
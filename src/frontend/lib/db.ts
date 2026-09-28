import Dexie, { type EntityTable } from "dexie";

/**
 * Local-only offline layer. MongoDB (via the API) stays the source of
 * truth — this is a device-local working copy plus a queue of writes that
 * happened while offline, waiting to be replayed against the server.
 *
 * Scope (deliberately limited for V1, matches the offline-first plan):
 *  - Transactions: fully read/write offline (create, edit, delete).
 *  - Accounts / Categories / Settings: read-only cache offline. Creating a
 *    new account/category still requires connectivity — keeps the sync
 *    surface small, and in practice you set those up once, rarely offline.
 *  - Reports/analytics/statements: NOT cached — those are server-computed
 *    and need a fresh connection. Offline mode covers "log an expense on
 *    the go", not "review my full financial report with no signal".
 */

export type LocalTx = {
  clientId: string; // local primary key, always present
  serverId: string | null; // Mongo _id, filled in once synced
  type: string;
  amount: number;
  date: string;
  categoryId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  description: string;
  meta: unknown;
  updatedAt: string; // ISO
  deletedAt: string | null;
  dirty: boolean; // has local changes not yet confirmed by the server
};

export type LocalAccount = { id: string; name: string; kind: string; archived: boolean; sortOrder: number };
export type LocalCategory = {
  id: string;
  parentId: string | null;
  name: string;
  bucket: string;
  type: string;
  disabled: boolean;
  sortOrder: number;
};
export type LocalSettings = { key: string; value: unknown };

export type SyncQueueItem = {
  id?: number; // auto-increment
  entity: "transaction";
  op: "create" | "update" | "delete";
  clientId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

const db = new Dexie("finance-tracker-offline") as Dexie & {
  transactions: EntityTable<LocalTx, "clientId">;
  accounts: EntityTable<LocalAccount, "id">;
  categories: EntityTable<LocalCategory, "id">;
  settings: EntityTable<LocalSettings, "key">;
  syncQueue: EntityTable<SyncQueueItem, "id">;
};

db.version(1).stores({
  transactions: "clientId, serverId, date, type, updatedAt, dirty",
  accounts: "id",
  categories: "id, parentId",
  settings: "key",
  syncQueue: "++id, clientId, createdAt",
});

export default db;

export function newClientId() {
  return crypto.randomUUID();
}

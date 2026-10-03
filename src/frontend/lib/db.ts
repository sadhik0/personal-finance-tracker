import Dexie, { type EntityTable } from "dexie";
/** Device-local offline layer. Each signed-in user gets a separate database. */
export type LocalTx = {
  clientId: string;
  serverId: string | null;
  type: string;
  amount: number;
  date: string;
  categoryId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  description: string;
  meta: unknown;
  updatedAt: string;
  deletedAt: string | null;
  dirty: boolean;
  syncState?: "pending" | "synced" | "failed";
  syncError?: string;
};
export type LocalAccount = { id: string; name: string; kind: string; archived: boolean; sortOrder: number };
export type LocalCategory = { id: string; parentId: string | null; name: string; bucket: string; type: string; disabled: boolean; sortOrder: number };
export type LocalSettings = { key: string; value: unknown };
export type SyncQueueItem = {
  id?: number;
  entity: "transaction";
  op: "create" | "update" | "delete";
  clientId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError?: string;
  failed?: boolean;
};
export type FinanceDb = Dexie & {
  transactions: EntityTable<LocalTx, "clientId">;
  accounts: EntityTable<LocalAccount, "id">;
  categories: EntityTable<LocalCategory, "id">;
  settings: EntityTable<LocalSettings, "key">;
  syncQueue: EntityTable<SyncQueueItem, "id">;
};
const ACTIVE_USER_KEY = "pft-active-user-id";
const LEGACY_DB = "finance-tracker-offline";
let activeUserId: string | null = null;
let activeDb: FinanceDb | null = null;
function safeUserId(userId: string) {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100) || "unknown";
}
function createDb(userId: string): FinanceDb {
  const db = new Dexie(`finance-tracker-user-${safeUserId(userId)}`) as FinanceDb;
  db.version(1).stores({
    transactions: "clientId, serverId, date, type, updatedAt, dirty, syncState",
    accounts: "id",
    categories: "id, parentId",
    settings: "key",
    syncQueue: "++id, clientId, createdAt, failed",
  });
  return db;
}
function storedUserId() {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(ACTIVE_USER_KEY); } catch { return null; }
}
export function setActiveUserId(userId: string | null) {
  if (activeUserId === userId && activeDb) return;
  activeDb?.close();
  activeUserId = userId;
  activeDb = userId ? createDb(userId) : null;
  if (typeof window !== "undefined") {
    try {
      if (userId) window.localStorage.setItem(ACTIVE_USER_KEY, userId);
      else window.localStorage.removeItem(ACTIVE_USER_KEY);
    } catch { /* ignore */ }
    window.dispatchEvent(new Event("local-user-changed"));
  }
}
export function getActiveUserId() {
  if (!activeUserId) {
    const id = storedUserId();
    if (id) setActiveUserId(id);
  }
  return activeUserId;
}
export function getDb(): FinanceDb {
  const userId = getActiveUserId();
  if (!userId) throw new Error("No signed-in user is available for local storage");
  if (!activeDb) activeDb = createDb(userId);
  return activeDb;
}
export async function clearActiveUserData() {
  if (!activeDb) return;
  await Promise.all([
    activeDb.transactions.clear(), activeDb.accounts.clear(), activeDb.categories.clear(),
    activeDb.settings.clear(), activeDb.syncQueue.clear(),
  ]);
}
export function closeActiveDb() {
  activeDb?.close();
  activeDb = null;
  activeUserId = null;
  if (typeof window !== "undefined") {
    try { window.localStorage.removeItem(ACTIVE_USER_KEY); } catch { /* ignore */ }
    window.dispatchEvent(new Event("local-user-changed"));
  }
}
export async function removeLegacyDb() {
  if (typeof window === "undefined") return;
  try { await Dexie.delete(LEGACY_DB); } catch { /* ignore */ }
}
export function newClientId() { return crypto.randomUUID(); }

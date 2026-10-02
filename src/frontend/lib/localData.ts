import { clearActiveUserData, closeActiveDb, getDb, removeLegacyDb } from "./db";
import { flushQueue } from "./syncEngine";
export async function clearLocalData() {
  await clearActiveUserData();
  closeActiveDb();
  await removeLegacyDb();
  if (typeof caches !== "undefined") {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}
export async function clearExpiredUserData() {
  await clearActiveUserData();
  closeActiveDb();
}
export async function confirmLogout(): Promise<boolean> {
  if (navigator.onLine) await flushQueue();
  const n = await getDb().syncQueue.count();
  if (n === 0) return true;
  return window.confirm(`${n} change${n === 1 ? " is" : "s are"} not synced yet and will be lost if you log out. Log out anyway?`);
}

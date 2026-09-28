import db from "./db";
import { flushQueue } from "./syncEngine";

/** Wipes everything this app keeps on the device: the offline database
 * (transactions, cached accounts/categories, local PIN, queue) and the
 * service-worker page cache. Called on logout so the next person using
 * this browser sees nothing. */
export async function clearLocalData() {
  await Promise.all([
    db.transactions.clear(),
    db.accounts.clear(),
    db.categories.clear(),
    db.settings.clear(),
    db.syncQueue.clear(),
  ]);
  if (typeof caches !== "undefined") {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}

/** Tries to push pending offline changes first; if some still could not be
 * synced, asks before they get thrown away. Returns false if cancelled. */
export async function confirmLogout(): Promise<boolean> {
  if (navigator.onLine) await flushQueue();
  const n = await db.syncQueue.count();
  if (n === 0) return true;
  return window.confirm(
    `${n} change${n === 1 ? " is" : "s are"} not synced yet and will be lost if you log out. Log out anyway?`,
  );
}

/**
 * Small cache for read-only API answers (reports, rules).
 *
 * - Lives in memory AND in localStorage, so it also survives closing/reloading the app.
 * - "Fresh" answers (younger than FRESH_MS) are used as-is: no server call.
 * - Any change (a saved transaction, a settings edit, a POST/PUT/DELETE) marks every
 *   entry stale. Stale entries still show instantly, then get refreshed from the server.
 * - Wiped on logout, login, account delete, and when the session expires (401).
 *
 * No React in here on purpose, so both client.ts and the hook can import it.
 */
type Entry = { data: unknown; at: number };

const KEY = "pft-api-cache-v1";
const FRESH_MS = 3 * 60 * 1000; // no re-fetch inside this window (unless something changed)
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // never show anything older than a day
const MAX_ENTRIES = 10;

const mem = new Map<string, Entry>();
let loaded = false;

const hasWindow = () => typeof window !== "undefined";

function persist() {
  if (!hasWindow()) return;
  try {
    const newest = [...mem.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(newest));
  } catch {
    // storage full or blocked: the in-memory copy still works
  }
}

/** Reads the saved copy into memory. Call from effects/handlers only (never while rendering, or
 * the first client render would differ from the server-rendered page). */
function loadPersisted() {
  if (loaded || !hasWindow()) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const list = JSON.parse(raw) as [string, Entry][];
    const now = Date.now();
    for (const [url, e] of list)
      if (typeof url === "string" && e && now - e.at < MAX_AGE_MS && !mem.has(url)) mem.set(url, e);
  } catch {
    // corrupt: ignore
  }
}

export const cacheStore = {
  /** In-memory only, safe to call during render. */
  peek(url: string) {
    return mem.get(url);
  },
  /** Also looks in the saved copy. Effects/handlers only. */
  read(url: string) {
    loadPersisted();
    return mem.get(url);
  },
  isFresh(e: Entry | undefined) {
    return !!e && Date.now() - e.at < FRESH_MS;
  },
  write(url: string, data: unknown) {
    loadPersisted();
    mem.set(url, { data, at: Date.now() });
    persist();
  },
  /** Something changed: keep the data for instant display but force a refresh. */
  invalidate() {
    loadPersisted();
    for (const e of mem.values()) e.at = 0;
    persist();
  },
  clear() {
    mem.clear();
    loaded = true;
    if (hasWindow()) {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
    }
  },
};

// A transaction was saved on this device, or finished syncing to the server.
if (hasWindow()) window.addEventListener("tx-saved", () => cacheStore.invalidate());

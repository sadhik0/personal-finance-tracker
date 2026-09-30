"use client";

import { useEffect, useState } from "react";
import { api } from "./client";
import { cacheStore } from "./cacheStore";

/** Call on logout / login so the next person never sees old numbers. */
export function clearApiCache() {
  cacheStore.clear();
}

/**
 * Cache-first loader for read-only API data.
 *
 * 1. Fresh copy in the cache (under 3 minutes, nothing changed since)  -> use it, NO server call.
 * 2. Older copy                                                        -> show it instantly, refresh in the background.
 * 3. Nothing cached (first visit, cache cleared)                       -> fetch from the server.
 *
 * Any save/edit anywhere marks the cache stale, so numbers never lag behind your own changes.
 * Offline or failed request: keeps showing what it has and sets `error`.
 */
export function useApiResource<T>(url: string | null, reloadKey = 0) {
  const [state, setState] = useState<{ url: string | null; data: T | undefined; error: boolean }>({
    url: null,
    data: undefined,
    error: false,
  });

  useEffect(() => {
    if (!url) return;
    let alive = true;
    const entry = cacheStore.read(url);
    if (entry) {
      // async on purpose: shows the saved copy on the next tick
      void Promise.resolve().then(() => {
        if (alive) setState({ url, data: entry.data as T, error: false });
      });
      if (cacheStore.isFresh(entry)) {
        return () => {
          alive = false;
        };
      }
    }
    api<T>(url)
      .then((d) => {
        cacheStore.write(url, d);
        if (alive) setState({ url, data: d, error: false });
      })
      .catch(() => {
        if (alive) setState((s) => ({ url, data: s.data, error: true }));
      });
    return () => {
      alive = false;
    };
  }, [url, reloadKey]);

  const cached = url ? (cacheStore.peek(url)?.data as T | undefined) : undefined;
  const fresh = state.url === url ? state.data : undefined;
  return {
    data: fresh ?? cached ?? state.data,
    /** true while data for the current url has not arrived yet */
    loading: !!url && state.url !== url,
    error: state.error,
  };
}

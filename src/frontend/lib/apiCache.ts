"use client";

import { useEffect, useState } from "react";
import { api } from "./client";

/**
 * Stale-while-revalidate for read-only API data.
 *
 * - Revisit a page and the last data shows INSTANTLY while fresh data loads.
 * - Switch period and the previous numbers stay (dimmed, `loading` = true)
 *   instead of the page blanking out.
 * - Offline / failed request: keeps what it has, sets `error`.
 *
 * Nothing here delays a request. It only remembers the previous answer.
 */
const cache = new Map<string, unknown>();

/** Call on logout so the next person/account never sees old numbers. */
export function clearApiCache() {
  cache.clear();
}

export function useApiResource<T>(url: string | null, reloadKey = 0) {
  const [state, setState] = useState<{ url: string | null; data: T | undefined; error: boolean }>({
    url: null,
    data: undefined,
    error: false,
  });

  useEffect(() => {
    if (!url) return;
    let alive = true;
    api<T>(url)
      .then((d) => {
        cache.set(url, d);
        if (alive) setState({ url, data: d, error: false });
      })
      .catch(() => {
        if (alive) setState((s) => ({ url, data: s.data, error: true }));
      });
    return () => {
      alive = false;
    };
  }, [url, reloadKey]);

  const cached = url ? (cache.get(url) as T | undefined) : undefined;
  const fresh = state.url === url ? state.data : undefined;
  return {
    data: fresh ?? cached ?? state.data,
    /** true while data for the current url has not arrived yet */
    loading: !!url && state.url !== url,
    error: state.error,
  };
}

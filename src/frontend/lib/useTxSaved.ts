"use client";

import { useEffect, useState } from "react";

/**
 * Returns a number that goes up every time a transaction is saved locally
 * or finished syncing to the server ("tx-saved" event). Put it in a page's
 * data-loading effect dependencies so the page reloads itself.
 */
export function useTxSaved() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const h = () => setTick((t) => t + 1);
    window.addEventListener("tx-saved", h);
    return () => window.removeEventListener("tx-saved", h);
  }, []);
  return tick;
}
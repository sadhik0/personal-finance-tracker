"use client";

import { useEffect } from "react";
import { wireSyncEngine } from "@/frontend/lib/syncEngine";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
    }
    wireSyncEngine();
  }, []);
  return null;
}

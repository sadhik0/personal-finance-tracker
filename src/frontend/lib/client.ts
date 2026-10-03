"use client";
import { cacheStore } from "./cacheStore";
import { clearActiveUserData, closeActiveDb } from "./db";
export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const browserTimeZone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const opts: RequestInit = { ...init, headers: { "Content-Type": "application/json", "x-timezone": browserTimeZone, ...(init?.headers ?? {}) } };
  if (init?.json !== undefined) opts.body = JSON.stringify(init.json);
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  const method = (init?.method ?? "GET").toUpperCase();
  if (res.ok && method !== "GET" && method !== "HEAD") cacheStore.invalidate();
  if (res.status === 401) {
    cacheStore.clear();
    void clearActiveUserData().finally(() => closeActiveDb());
    if (typeof window !== "undefined") window.dispatchEvent(new Event("session-expired"));
  }
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error ?? "Request failed") as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}
export const inr = (n: number, decimals = 0) => `₹${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
export const periodLabel = (p: string) => { const [y, m] = p.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }); };
export const shortPeriod = (p: string) => { const [y, m] = p.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" }); };
export const currentPeriod = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
export const shiftPeriod = (p: string, delta: number) => { const [y, m] = p.split("-").map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const shortDay = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }); };
export const addDaysClient = (date: string, n: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const monthBounds = (period: string) => { const [y, m] = period.split("-").map(Number); const start = new Date(Date.UTC(y, m - 1, 1)); const end = new Date(Date.UTC(y, m, 0)); return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }; };

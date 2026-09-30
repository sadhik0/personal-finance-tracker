"use client";

import { api } from "./client";

const PAGE = 500;

type Row = { id: string; updatedAt: string };

/**
 * Loads EVERY matching transaction by following the cursor until a page comes
 * back short. `filters` are extra query params (from, to, type, ...).
 */
export async function fetchAllTransactions<T extends Row>(filters: Record<string, string> = {}): Promise<T[]> {
  const all: T[] = [];
  let cursor = "";
  for (;;) {
    const qs = new URLSearchParams({ ...filters, limit: String(PAGE), order: "updated" });
    if (cursor) qs.set("cursor", cursor);
    const page = await api<T[]>(`/api/transactions?${qs}`);
    all.push(...page);
    if (page.length < PAGE) return all;
    const last = page[page.length - 1];
    const next = `${new Date(last.updatedAt).toISOString()}_${last.id}`;
    if (next === cursor) return all; // safety: never loop forever
    cursor = next;
  }
}

import { periodBounds, periodKeyFor, shiftPeriodKey, type PeriodKind } from "./periods";
export type DashboardKind = "all" | "week" | "month" | "quarter" | "half";
export type DashboardPeriod = { kind: DashboardKind; key: string; start?: string; end?: string };
const iso = (d: Date) => d.toISOString().slice(0, 10);
export function currentWeekKey(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return iso(d);
}
export function weekBounds(key: string, weeks = 1) {
  const start = new Date(`${key}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + weeks * 7 - 1);
  return { start: iso(start), end: iso(end) };
}
export function shiftDashboardPeriod(p: DashboardPeriod, delta: number): DashboardPeriod {
  if (p.kind === "all") return p;
  if (p.kind === "week") {
    const d = new Date(`${p.key}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta * 7);
    return { ...p, key: iso(d) };
  }
  const mapped: PeriodKind = p.kind;
  return { ...p, key: shiftPeriodKey(mapped, p.key, delta) };
}
export function dashboardBounds(p: DashboardPeriod, weeks = 1) {
  if (p.kind === "week") return weekBounds(p.key, weeks);
  if (p.kind === "all") return undefined;
  return periodBounds(p.kind, p.key);
}
export function dashboardPeriodLabel(p: DashboardPeriod, weeks = 1) {
  if (p.kind === "all") return "All time";
  if (p.kind === "week") {
    const b = weekBounds(p.key, weeks);
    return weeks === 2 ? `${b.start} – ${b.end}` : `Week of ${b.start}`;
  }
  return periodBounds(p.kind, p.key).label;
}
export function convertDashboardKey(kind: DashboardKind, key: string) {
  if (kind === "week" || kind === "all") return kind === "week" ? currentWeekKey() : "all";
  return periodKeyFor(kind, new Date(`${key}T00:00:00Z`));
}

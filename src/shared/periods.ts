/**
 * One period engine for Statements (and anything else that needs a date range).
 * Pure functions, no server or browser dependencies, so the API, the pages and
 * the PDF/Excel export all agree on exactly what "Q3 2026" means.
 *
 * Calendar periods:  Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec
 *                    H1 Jan-Jun, H2 Jul-Dec, Year Jan-Dec
 *
 * Keys:  month "2026-09" · quarter "2026-Q3" · half "2026-H2" · year "2026"
 */
export type PeriodKind = "month" | "quarter" | "half" | "year";

export const PERIOD_KINDS: { kind: PeriodKind; label: string }[] = [
  { kind: "month", label: "Monthly" },
  { kind: "quarter", label: "Quarterly" },
  { kind: "half", label: "Half-Yearly" },
  { kind: "year", label: "Yearly" },
];

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export type PeriodBounds = {
  kind: PeriodKind;
  key: string;
  /** first day, YYYY-MM-DD */
  start: string;
  /** last day, YYYY-MM-DD */
  end: string;
  /** every month in the period, YYYY-MM */
  months: string[];
  /** short label, e.g. "Q3 2026" */
  label: string;
  /** label used in export titles, e.g. "Q3 2026 (Jul–Sep)" */
  title: string;
};

function parse(kind: PeriodKind, key: string): { year: number; first: number; count: number } | null {
  let m: RegExpMatchArray | null;
  switch (kind) {
    case "month":
      m = key.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
      return m ? { year: +m[1], first: +m[2], count: 1 } : null;
    case "quarter":
      m = key.match(/^(\d{4})-Q([1-4])$/);
      return m ? { year: +m[1], first: (+m[2] - 1) * 3 + 1, count: 3 } : null;
    case "half":
      m = key.match(/^(\d{4})-H([12])$/);
      return m ? { year: +m[1], first: (+m[2] - 1) * 6 + 1, count: 6 } : null;
    case "year":
      m = key.match(/^(\d{4})$/);
      return m ? { year: +m[1], first: 1, count: 12 } : null;
  }
}

export function isValidPeriodKey(kind: string, key: string): boolean {
  return (
    (kind === "month" || kind === "quarter" || kind === "half" || kind === "year") &&
    parse(kind, key) !== null &&
    +key.slice(0, 4) >= 2000 &&
    +key.slice(0, 4) <= 2100
  );
}

export function periodBounds(kind: PeriodKind, key: string): PeriodBounds {
  const p = parse(kind, key);
  if (!p) throw new Error(`Invalid ${kind} period: ${key}`);
  const last = p.first + p.count - 1;
  const months: string[] = [];
  for (let m = p.first; m <= last; m++) months.push(`${p.year}-${pad(m)}`);
  const start = isoDate(new Date(Date.UTC(p.year, p.first - 1, 1)));
  const end = isoDate(new Date(Date.UTC(p.year, last, 0)));
  const span = `${SHORT[p.first - 1]}–${SHORT[last - 1]}`;
  let label: string;
  let title: string;
  switch (kind) {
    case "month":
      label = title = `${MONTH_NAMES[p.first - 1]} ${p.year}`;
      break;
    case "quarter":
      label = `Q${(p.first - 1) / 3 + 1} ${p.year}`;
      title = `${label} (${span})`;
      break;
    case "half":
      label = `H${(p.first - 1) / 6 + 1} ${p.year}`;
      title = `${label} (${span})`;
      break;
    default:
      label = `${p.year}`;
      title = `Year ${p.year} (Jan–Dec)`;
  }
  return { kind, key, start, end, months, label, title };
}

/** Which period of this kind contains the given date (default: today, UTC). */
export function periodKeyFor(kind: PeriodKind, date: string | Date = new Date()): string {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00Z`) : date;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  switch (kind) {
    case "month":
      return `${y}-${pad(m)}`;
    case "quarter":
      return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
    case "half":
      return `${y}-H${m <= 6 ? 1 : 2}`;
    default:
      return `${y}`;
  }
}

/** Previous / next period of the same kind (delta = -1 / +1 ...). */
export function shiftPeriodKey(kind: PeriodKind, key: string, delta: number): string {
  const p = parse(kind, key);
  if (!p) throw new Error(`Invalid ${kind} period: ${key}`);
  const step = kind === "year" ? 12 : p.count;
  const shifted = new Date(Date.UTC(p.year, p.first - 1 + delta * step, 1));
  return periodKeyFor(kind, shifted);
}

/** Convert a key when the user changes the period type, keeping the same time. */
export function convertPeriodKey(fromKind: PeriodKind, fromKey: string, toKind: PeriodKind): string {
  const b = periodBounds(fromKind, fromKey);
  return periodKeyFor(toKind, b.end);
}

export const monthLabel = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return `${SHORT[m - 1]} ${y}`;
};

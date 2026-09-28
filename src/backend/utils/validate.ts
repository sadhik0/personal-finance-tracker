/**
 * Small server-side input checks. Every helper either returns a clean value
 * or throws InputError, which withUser() turns into a 400 with the message.
 * Plain TypeScript on purpose: no extra dependency, easy to test.
 */
export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

const ID_RE = /^[a-f0-9]{24}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const CLIENT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new InputError("Request body must be valid JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new InputError("Request body must be a JSON object");
  return body as Record<string, unknown>;
}

/** Trimmed text. `clip` shortens too-long text instead of rejecting it
 * (used for descriptions, so an offline entry is never lost to a limit). */
export function text(
  v: unknown,
  field: string,
  o: { max: number; min?: number; clip?: boolean; fallback?: string },
): string {
  if (v === undefined || v === null) {
    if (o.fallback !== undefined) return o.fallback;
    v = "";
  }
  if (typeof v === "number") v = String(v);
  if (typeof v !== "string") throw new InputError(`${field} must be text`);
  let s = v.trim();
  if (s.length > o.max) {
    if (o.clip) s = s.slice(0, o.max);
    else throw new InputError(`${field} is too long (max ${o.max} characters)`);
  }
  if (s.length < (o.min ?? 0)) throw new InputError(`${field} is required`);
  return s;
}

export function num(v: unknown, field: string, o: { min?: number; max?: number } = {}): number {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new InputError(`${field} must be a number`);
  const min = o.min ?? -1e12;
  const max = o.max ?? 1e12;
  if (n < min || n > max) throw new InputError(`${field} is out of range`);
  return n;
}

export function positive(v: unknown, field: string): number {
  const n = num(v, field);
  if (!(n > 0)) throw new InputError(`${field} must be greater than 0`);
  return n;
}

export function isoDate(v: unknown, field: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!DATE_RE.test(s)) throw new InputError(`${field} must be a date like 2026-09-28`);
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const real = dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  if (!real || y < 1990 || y > 2100) throw new InputError(`${field} is not a valid date`);
  return s;
}

export function period(v: unknown, field: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!PERIOD_RE.test(s)) throw new InputError(`${field} must look like 2026-09`);
  return s;
}

export function oneOf<T extends string>(v: unknown, field: string, list: readonly T[], fallback?: T): T {
  if ((v === undefined || v === null || v === "") && fallback !== undefined) return fallback;
  if (typeof v !== "string" || !(list as readonly string[]).includes(v))
    throw new InputError(`${field} must be one of: ${list.join(", ")}`);
  return v as T;
}

export function bool(v: unknown, field: string): boolean {
  if (typeof v !== "boolean") throw new InputError(`${field} must be true or false`);
  return v;
}

/** A MongoDB id, or null when empty. Throws if it is not id-shaped. */
export function idOrNull(v: unknown, field: string): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || !ID_RE.test(v)) throw new InputError(`${field} is invalid`);
  return v;
}

/** An id taken from the URL. */
export function paramId(v: unknown): string {
  if (typeof v !== "string" || !ID_RE.test(v)) throw new InputError("Invalid id");
  return v;
}

export function clientIdOrNull(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || !CLIENT_ID_RE.test(v)) throw new InputError("clientId is invalid");
  return v;
}

/** Free-form extra data on a transaction: small plain object, else dropped. */
export function metaOrNull(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (typeof v !== "object" || Array.isArray(v)) return null;
  return JSON.stringify(v).length <= 2000 ? v : null;
}

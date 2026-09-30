/**
 * Small server-side input checks. Every helper either returns a clean value
 * or throws InputError, which withUser() turns into a 400 with the message.
 * Plain TypeScript on purpose: no extra dependency, easy to test.
 */
export class InputError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "InputError";
    this.status = status;
  }
}

/** Largest JSON body any API route accepts. Real payloads are well under 5 KB. */
export const MAX_BODY_BYTES = 50_000;

const ID_RE = /^[a-f0-9]{24}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const CLIENT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Reads a JSON object body with a hard size cap. Two gates:
 *  1. Content-Length header (cheap early reject), and
 *  2. a streamed byte count while reading, because the header can be missing
 *     (chunked uploads) or simply wrong.
 */
export async function readJson(
  req: Request,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<Record<string, unknown>> {
  const tooBig = () => new InputError("Request body is too large", 413);
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooBig();

  let raw = "";
  if (req.body) {
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw tooBig();
      }
      chunks.push(value);
    }
    const all = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      all.set(c, offset);
      offset += c.byteLength;
    }
    raw = new TextDecoder().decode(all);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new InputError("Request body must be valid JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new InputError("Request body must be a JSON object");
  return body as Record<string, unknown>;
}

/** Like readJson, but returns {} for a missing/bad/oversized body (the
 * calling route then fails its own field checks). */
export const readJsonOrEmpty = (req: Request) =>
  readJson(req).catch((): Record<string, unknown> => ({}));

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

/** Rejects dates after today. One day of slack, because the user's calendar day can be a day
 * ahead of UTC (India, Australia...); the form itself limits the picker to the exact local today. */
export function notFutureDate(date: string, field = "Date"): string {
  const limit = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (date > limit) throw new InputError(`${field} cannot be in the future`);
  return date;
}

/** Salary / interest recorded from the dashboard recommendation may sit in next month. */
export const isRuleEntry = (meta: unknown) =>
  !!meta && typeof meta === "object" && (meta as { source?: unknown }).source === "expected_rule";

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

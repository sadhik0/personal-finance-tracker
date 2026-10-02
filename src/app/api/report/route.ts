import { ok, withUser } from "@/backend/utils/response";
import { currentPeriod } from "@/backend/services/finance.service";
import { buildReport } from "@/backend/services/report.service";
import { InputError } from "@/backend/utils/validate";
import { isValidPeriodKey, periodBounds, shiftPeriodKey, type PeriodKind } from "@/shared/periods";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CUSTOM_DAYS = 1100;

/**
 * GET /api/report
 *   ?kind=quarter|half|year&key=2026-Q3   statement period (one engine for all of them)
 *   ?period=2026-09[&start=..&end=..]     a month, optionally with an explicit date range
 */
export async function GET(req: Request) {
  return withUser(req, async (user) => {
    const url = new URL(req.url);
    const timeZone = req.headers.get("x-timezone") || "UTC";
    const safeTimeZone = (() => { try { new Intl.DateTimeFormat("en-US", { timeZone }); return timeZone; } catch { return "UTC"; } })();
    const kind = url.searchParams.get("kind");
    const key = url.searchParams.get("key");

    if (kind && kind !== "month") {
      if (!key || !isValidPeriodKey(kind, key)) throw new InputError("Invalid statement period");
      const k = kind as PeriodKind;
      const b = periodBounds(k, key);
      const prev = periodBounds(k, shiftPeriodKey(k, key, -1));
      const report = await buildReport(
        user.id,
        b.months[b.months.length - 1],
        1,
        { start: b.start, end: b.end },
        { prevRange: { start: prev.start, end: prev.end }, kind: k, label: b.label, title: b.title },
      );
      return ok(report);
    }

    const period = key && isValidPeriodKey("month", key) ? key : url.searchParams.get("period") ?? currentPeriod(safeTimeZone);
    const months = Number(url.searchParams.get("months") ?? 6);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    let range: { start: string; end: string } | undefined;
    if (start && end) {
      if (!DATE_RE.test(start) || !DATE_RE.test(end) || start > end) throw new InputError("Invalid date range");
      const days = (Date.parse(end) - Date.parse(start)) / 86400000;
      if (days > MAX_CUSTOM_DAYS) throw new InputError("Date range is too long");
      range = { start, end };
    }
    const report = await buildReport(user.id, period, Math.min(Math.max(months, 1), 24), range, { kind: "month" });
    return ok(report);
  });
}

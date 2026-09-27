import { ok, withUser } from "@/backend/utils/response";
import { currentPeriod } from "@/backend/services/finance.service";
import { buildReport } from "@/backend/services/report.service";

export async function GET(req: Request) {
  return withUser(async (user) => {
    const url = new URL(req.url);
    const period = url.searchParams.get("period") ?? currentPeriod();
    const months = Number(url.searchParams.get("months") ?? 6);
    const report = await buildReport(user.id, period, Math.min(Math.max(months, 1), 24));
    return ok(report);
  });
}

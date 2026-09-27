import { destroySession } from "@/backend/services/auth.service";
import { ok } from "@/backend/utils/response";

export async function POST() {
  await destroySession();
  return ok({ ok: true });
}

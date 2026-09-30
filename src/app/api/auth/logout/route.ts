import { requireSameOrigin } from "@/backend/utils/sameOrigin";
import { destroySession } from "@/backend/services/auth.service";
import { ok } from "@/backend/utils/response";

export async function POST(req: Request) {
  const blocked = requireSameOrigin(req);
  if (blocked) return blocked;
  await destroySession();
  return ok({ ok: true });
}

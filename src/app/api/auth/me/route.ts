import { getCurrentUser } from "@/backend/services/auth.service";
import { ok } from "@/backend/utils/response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return ok({ user: null });
  return ok({
    user: { id: user.id, username: user.username, displayName: user.displayName, hasPin: !!user.pinHash },
  });
}

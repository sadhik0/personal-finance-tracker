import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/backend/services/auth.service";
import Shell from "@/frontend/components/Shell";

// Every page under this layout depends on the logged-in user's session and
// live database data. Without this, Next.js tries to pre-render these pages
// at BUILD time (before any user exists), which needs a database connection
// during the build itself and fails builds like Vercel's if that connection
// isn't reachable from the build machine.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return <Shell displayName={user.displayName || user.username}>{children}</Shell>;
}
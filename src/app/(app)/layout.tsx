import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/backend/services/auth.service";
import Shell from "@/frontend/components/Shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return <Shell userId={user.id} displayName={user.displayName || user.username}>{children}</Shell>;
}

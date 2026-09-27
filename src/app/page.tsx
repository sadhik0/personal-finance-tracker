import { redirect } from "next/navigation";
import { getCurrentUser } from "@/backend/services/auth.service";
import AuthForm from "@/frontend/components/AuthForm";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-[#111827] border-r border-[#263449]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#38BDF8] to-[#8B5CF6] flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold">Finance Tracker</p>
            <p className="text-xs text-[#94A3B8]">Personal financial intelligence</p>
          </div>
        </div>
        <div className="space-y-5 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">
            Track income, expenses, savings, investments, family support and debt — in one
            private dashboard.
          </h1>
          <ul className="space-y-2 text-sm text-[#94A3B8]">
            <li>◉ 50/30/20 benchmark, personal plan and actual behaviour</li>
            <li>⇄ Nine transaction types with correct accounting rules</li>
            <li>▣ Income & expense, balance sheet and cash-flow statements</li>
            <li>◔ Analytics, category drill-down and limit alerts</li>
            <li>▤ Excel + PDF export, responsive on phone and laptop</li>
          </ul>
        </div>
        <p className="text-xs text-[#94A3B8]">
          Stage 1 build — no personal category limits hard-coded. Configure after your first
          salary.
        </p>
      </div>
      <div className="flex items-center justify-center p-6">
        <AuthForm />
      </div>
    </div>
  );
}
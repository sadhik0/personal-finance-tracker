"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import TxForm from "./TxForm";
import { Toast } from "./ui";
import LockScreen from "./LockScreen";
import SyncStatus from "./SyncStatus";
import { api, currentPeriod, periodLabel } from "@/frontend/lib/client";
import { clearLocalData, confirmLogout } from "@/frontend/lib/localData";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "◉" },
  { href: "/transactions", label: "Transactions", icon: "⇄" },
  { href: "/statements", label: "Statements", icon: "▣" },
  { href: "/analytics", label: "Analytics", icon: "◔" },
  { href: "/accounts", label: "Accounts", icon: "◇" },
];

export default function Shell({
  children,
  displayName,
}: {
  children: ReactNode;
  displayName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [quick, setQuick] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pop, setPop] = useState<string | null>(null);

  const sideRefs = useRef<Record<string, HTMLElement | null>>({});
  const dockRefs = useRef<Record<string, HTMLElement | null>>({});
  const [sidePos, setSidePos] = useState<{ top: number; left: number; width: number; height: number } | null>(
    null,
  );
  const [dockPos, setDockPos] = useState<{ left: number; width: number } | null>(null);

  const sidebarKey =
    NAV.find((n) => pathname.startsWith(n.href))?.href ??
    (pathname.startsWith("/settings") ? "/settings" : null);
  const DOCK_KEYS = ["/dashboard", "/transactions", "/analytics", "/more"];
  const dockKey = DOCK_KEYS.find((h) => pathname.startsWith(h)) ?? null;

  useLayoutEffect(() => {
    const el = sidebarKey ? sideRefs.current[sidebarKey] : null;
    if (el) setSidePos({ top: el.offsetTop, left: el.offsetLeft, width: el.offsetWidth, height: el.offsetHeight });
  }, [sidebarKey]);

  useLayoutEffect(() => {
    const el = dockKey ? dockRefs.current[dockKey] : null;
    if (el) setDockPos({ left: el.offsetLeft, width: el.offsetWidth });
  }, [dockKey]);

  function tap(key: string) {
    setPop(key);
    window.setTimeout(() => setPop((p) => (p === key ? null : p)), 380);
  }

  function saved(msg: string) {
    setQuick(false);
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
    // router.refresh() fetches from the server: skip it offline (it blanks the page)
    if (navigator.onLine) router.refresh();
    window.dispatchEvent(new CustomEvent("tx-saved"));
  }

  async function logout() {
    if (!(await confirmLogout())) return;
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      window.alert("You need an internet connection to log out.");
      return;
    }
    await clearLocalData();
    router.push("/");
    router.refresh();
  }

  return (
    <LockScreen>
    <div className="min-h-screen bg-[#0B1220] text-[#F8FAFC]">
      {/* Sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-60 flex-col border-r border-[#263449] bg-[#111827] p-4">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#38BDF8] to-[#8B5CF6] flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Finance Tracker</p>
            <p className="text-[11px] text-[#94A3B8]">Personal financial intelligence</p>
          </div>
        </div>
        <div className="relative flex-1">
          {sidePos && (
            <div
              aria-hidden
              className="absolute rounded-lg border border-[#263449] bg-[#172033] transition-all duration-300 ease-out z-0"
              style={{ top: sidePos.top, left: sidePos.left, width: sidePos.width, height: sidePos.height }}
            />
          )}
          <nav className="mt-6 space-y-1">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  ref={(el) => {
                    sideRefs.current[n.href] = el;
                  }}
                  className={`relative z-10 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active ? "text-[#38BDF8]" : "text-[#94A3B8] hover:text-[#F8FAFC]"
                  }`}
                >
                  <span>{n.icon}</span>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 border-t border-[#263449] pt-4">
            <Link
              href="/settings"
              ref={(el) => {
                sideRefs.current["/settings"] = el;
              }}
              className={`relative z-10 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                pathname.startsWith("/settings") ? "text-[#38BDF8]" : "text-[#94A3B8] hover:text-[#F8FAFC]"
              }`}
            >
              <span>⚙</span> Settings
            </Link>
          </div>
        </div>
        <div className="mt-auto rounded-xl border border-[#263449] bg-[#172033] p-3">
          <p className="text-xs text-[#94A3B8]">Signed in as</p>
          <p className="text-sm font-medium">{displayName}</p>
          <button onClick={logout} className="mt-2 text-xs text-[#EF4444] hover:underline">
            Log out
          </button>
        </div>
      </aside>

      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-[#263449] bg-[#0B1220]/85 backdrop-blur lg:pl-60">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="lg:hidden flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#38BDF8] to-[#8B5CF6] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
            </div>
            <span className="text-sm font-semibold">Finance Tracker</span>
          </div>
          <div className="hidden lg:flex items-center gap-3 text-sm text-[#94A3B8]">
            {periodLabel(currentPeriod())}
            <SyncStatus />
          </div>
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <SyncStatus />
            </div>
            <button
              onClick={() => setQuick(true)}
              className="hidden lg:block btn btn-primary text-xs"
            >
              + Add transaction
            </button>
            <button
              onClick={logout}
              className="lg:hidden rounded-full border border-[#263449] px-3 py-1 text-xs text-[#94A3B8]"
            >
              {displayName.slice(0, 1).toUpperCase()} · Exit
            </button>
          </div>
        </div>
      </header>

      <main className="lg:pl-60 pb-32 lg:pb-10">
        <div className="mx-auto max-w-6xl px-4 py-5">{children}</div>
      </main>

      {/* Mobile / tablet dock */}
      <nav className="lg:hidden fixed bottom-4 inset-x-0 z-40 flex justify-center px-4">
        <div className="liquid-glass relative flex items-center gap-1 rounded-full px-3 py-2">
          {dockPos && (
            <div
              aria-hidden
              className="absolute top-2 bottom-2 rounded-full bg-white/10 border border-white/15 transition-all duration-300 ease-out z-0"
              style={{ left: dockPos.left, width: dockPos.width }}
            />
          )}
          <MobileLink
            href="/dashboard"
            icon="◉"
            label="Home"
            active={pathname.startsWith("/dashboard")}
            popped={pop === "/dashboard"}
            onTap={() => tap("/dashboard")}
            linkRef={(el) => {
              dockRefs.current["/dashboard"] = el;
            }}
          />
          <MobileLink
            href="/transactions"
            icon="⇄"
            label="Txns"
            active={pathname.startsWith("/transactions")}
            popped={pop === "/transactions"}
            onTap={() => tap("/transactions")}
            linkRef={(el) => {
              dockRefs.current["/transactions"] = el;
            }}
          />
          <button
            onClick={() => {
              tap("add");
              setQuick(true);
            }}
            className={`relative z-10 mx-1 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#38BDF8] to-[#8B5CF6] text-2xl font-bold text-[#04121f] shadow-lg shadow-sky-500/30 transition-transform active:scale-90 ${
              pop === "add" ? "dock-pop" : ""
            }`}
            aria-label="Add transaction"
          >
            +
          </button>
          <MobileLink
            href="/analytics"
            icon="◔"
            label="Analytics"
            active={pathname.startsWith("/analytics")}
            popped={pop === "/analytics"}
            onTap={() => tap("/analytics")}
            linkRef={(el) => {
              dockRefs.current["/analytics"] = el;
            }}
          />
          <MobileLink
            href="/more"
            icon="≡"
            label="More"
            active={pathname.startsWith("/more")}
            popped={pop === "/more"}
            onTap={() => tap("/more")}
            linkRef={(el) => {
              dockRefs.current["/more"] = el;
            }}
          />
        </div>
      </nav>

      {quick && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-[#263449] bg-[#111827] p-5 max-h-[92vh] overflow-y-auto animate-fadeup">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Quick transaction</h3>
              <button className="text-[#94A3B8]" onClick={() => setQuick(false)}>
                ✕
              </button>
            </div>
            <TxForm onSaved={saved} onCancel={() => setQuick(false)} />
          </div>
        </div>
      )}
      <Toast message={toast} />
    </div>
    </LockScreen>
  );
}

function MobileLink({
  href,
  icon,
  label,
  active,
  popped,
  onTap,
  linkRef,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  popped: boolean;
  onTap: () => void;
  linkRef?: (el: HTMLAnchorElement | null) => void;
}) {
  return (
    <Link
      href={href}
      onClick={onTap}
      ref={linkRef}
      className={`relative z-10 flex flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[10px] transition-transform active:scale-90 ${
        active ? "text-[#38BDF8]" : "text-[#94A3B8]"
      }`}
    >
      <span className={`text-base ${popped ? "dock-pop" : ""}`}>{icon}</span>
      {label}
    </Link>
  );
}
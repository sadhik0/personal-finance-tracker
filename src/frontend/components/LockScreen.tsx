"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  confirmPinOnNewDevice,
  hasLocalPin,
  shouldShowLockScreen,
  touchActivity,
  verifyLocalPin,
} from "@/frontend/lib/lock";
import { api } from "@/frontend/lib/client";

type Mode = "checking" | "unlocked" | "locked" | "confirm-new-device";

export default function LockScreen({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("checking");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const checkedThisSession = useRef(false);

  useEffect(() => {
    (async () => {
      const localPinSet = await hasLocalPin();
      if (!localPinSet) {
        // No PIN cached on this device. If the account has one set
        // server-side (set up on another device) and we're online, ask the
        // user to confirm it here once so this device gets its own cache.
        try {
          const r = await api<{ user: { hasPin: boolean } | null }>("/api/auth/me");
          if (r.user?.hasPin) {
            setMode("confirm-new-device");
            return;
          }
        } catch {
          /* offline and no local PIN — nothing to lock against yet */
        }
        setMode("unlocked");
        return;
      }
      const shouldLock = checkedThisSession.current ? false : await shouldShowLockScreen();
      checkedThisSession.current = true;
      setMode(shouldLock ? "locked" : "unlocked");
      if (!shouldLock) touchActivity();
    })();
  }, []);

  useEffect(() => {
    if (mode !== "unlocked") return;
    const onActivity = () => touchActivity();
    const onVisibility = async () => {
      if (document.visibilityState === "visible" && (await shouldShowLockScreen())) setMode("locked");
    };
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mode]);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (mode === "confirm-new-device") {
        await confirmPinOnNewDevice(pin);
      } else {
        const okPin = await verifyLocalPin(pin);
        if (!okPin) throw new Error("Incorrect PIN");
      }
      await touchActivity();
      setPin("");
      setMode("unlocked");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Incorrect PIN");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "checking") return null;
  if (mode === "unlocked") return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0B1220] px-6">
      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#38BDF8] to-[#8B5CF6] flex items-center justify-center mb-5">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <p className="text-sm text-[#94A3B8] mb-1">
        {mode === "confirm-new-device" ? "Confirm your PIN on this device" : "Enter your PIN"}
      </p>
      <input
        type="password"
        inputMode="numeric"
        autoFocus
        className="input w-40 text-center text-2xl tracking-[0.5em]"
        value={pin}
        maxLength={8}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && pin.length >= 4 && submit()}
      />
      {error && <p className="mt-2 text-sm text-[#EF4444]">{error}</p>}
      <button
        className="btn btn-primary mt-4 w-40"
        disabled={busy || pin.length < 4}
        onClick={submit}
      >
        {busy ? "Checking…" : "Unlock"}
      </button>
      {mode === "confirm-new-device" && (
        <p className="mt-4 max-w-xs text-center text-[11px] text-[#94A3B8]">
          This account already has a PIN set on another device. Enter it once here — needs a
          connection this first time only.
        </p>
      )}
    </div>
  );
}

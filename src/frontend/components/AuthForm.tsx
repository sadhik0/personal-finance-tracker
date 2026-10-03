"use client";

import { clearApiCache } from "@/frontend/lib/apiCache";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/frontend/lib/client";
import { setActiveUserId } from "@/frontend/lib/db";

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const account = await api<{ id: string }>(`/api/auth/${mode}`, {
        method: "POST",
        json:
          mode === "register"
            ? { username, password, displayName, inviteCode }
            : { username, password },
      });
      setActiveUserId(account.id);
      clearApiCache();
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm card p-6">
      <h2 className="text-xl font-semibold">
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h2>
      <p className="mt-1 text-sm text-[#94A3B8]">
        Secure username + password authentication.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-3">
        <div>
          <label className="label">Username</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>
        {mode === "register" && (
          <div>
            <label className="label">Display name</label>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
        )}
        <div>
          <label className="label">Password</label>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          {mode === "register" && <p className="mt-1 text-[11px] text-[#94A3B8]">At least 10 characters.</p>}
        </div>
        {mode === "register" && (
          <div>
            <label className="label">Invite code</label>
            <input
              className="input"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}
        {error && <p className="text-sm text-[#EF4444]">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>
      <button
        onClick={() => setMode(mode === "login" ? "register" : "login")}
        className="mt-4 w-full text-center text-xs text-[#38BDF8]"
      >
        {mode === "login" ? "Need an account? Register" : "Already registered? Log in"}
      </button>
    </div>
  );
}

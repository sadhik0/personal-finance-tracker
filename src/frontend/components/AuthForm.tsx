"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/frontend/lib/client";

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/auth/${mode}`, {
        method: "POST",
        json: { username, password, displayName },
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function demo() {
    setBusy(true);
    setError("");
    try {
      const u = `demo${Math.floor(Math.random() * 100000)}`;
      await api("/api/auth/register", {
        method: "POST",
        json: { username: u, password: "demo1234", displayName: "Sadhik" },
      });
      await api("/api/demo", { method: "POST" });
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
        </div>
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
      <div className="mt-4 border-t border-[#263449] pt-4">
        <button onClick={demo} disabled={busy} className="btn btn-ghost w-full text-xs">
          Explore demo with sample data
        </button>
      </div>
    </div>
  );
}

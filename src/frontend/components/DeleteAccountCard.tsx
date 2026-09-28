"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./ui";
import { api } from "@/frontend/lib/client";
import { clearLocalData } from "@/frontend/lib/localData";

export default function DeleteAccountCard() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setError("");
    if (!navigator.onLine) return setError("You need an internet connection to delete your account.");
    setBusy(true);
    try {
      await api("/api/auth/account", { method: "DELETE", json: { password } });
      await clearLocalData();
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the account");
      setBusy(false);
    }
  }

  return (
    <Card title="Delete account">
      <div className="space-y-3">
        <p className="text-xs text-[#94A3B8]">
          This permanently deletes your account and <b>all</b> its data: transactions, accounts, categories, rules and
          settings, from the server and from this device. It cannot be undone. Any device where you are logged in
          will be logged out. Export a backup first if you want to keep a copy.
        </p>
        <div>
          <label className="label">Your password</label>
          <input
            type="password"
            className="input"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Type DELETE to confirm</label>
          <input
            className="input"
            value={confirmText}
            autoComplete="off"
            onChange={(e) => setConfirmText(e.target.value)}
          />
          {confirmText !== "" && confirmText !== "DELETE" && (
            <p className="mt-1 text-xs text-[#F59E0B]">Type DELETE exactly, in capital letters.</p>
          )}
        </div>
        <button
          className="btn btn-ghost w-full text-[#EF4444]"
          disabled={busy || !password || confirmText !== "DELETE"}
          onClick={remove}
        >
          {busy ? "Deleting…" : "Delete my account permanently"}
        </button>
        {error && <p className="text-sm text-[#EF4444]">{error}</p>}
      </div>
    </Card>
  );
}

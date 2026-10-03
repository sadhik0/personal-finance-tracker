"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/frontend/lib/client";
import { Card, Toast } from "@/frontend/components/ui";
import BudgetFrameworkCard, { type PlanSettings } from "@/frontend/components/BudgetFrameworkCard";
import { ChartCardSkeleton, PageHeaderSkeleton } from "@/frontend/components/Skeleton";
import AppLockCard from "@/frontend/components/AppLockCard";
import BackupCard from "@/frontend/components/BackupCard";
import DeleteAllTransactionsButton from "@/frontend/components/DeleteAllTransactionsButton";
import DeleteAccountCard from "@/frontend/components/DeleteAccountCard";
import type { Category } from "@/frontend/components/TxForm";
import SyncProblems from "@/frontend/components/SyncProblems";
import HowItWorks from "@/frontend/components/HowItWorks";

type Settings = PlanSettings;
type Cat = Category & { limitMode: string | null; limitValue: string | null };

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [newCat, setNewCat] = useState({ name: "", parentId: "", bucket: "needs" });
  const [pwd, setPwd] = useState({ current: "", next: "" });

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api<Settings>("/api/settings"),
      api<Cat[]>("/api/categories"),
    ])
      .then(([s, c]) => {
        if (!alive) return;
        setSettings(s);
        setCats(c);
      })
      .catch(() => {
        // offline: keep what is on screen
      });
    return () => {
      alive = false;
    };
  }, [tick]);

  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 1800);
  }

  if (!settings)
    return (
      <div className="space-y-4" role="status" aria-label="Loading settings">
        <PageHeaderSkeleton />
        <ChartCardSkeleton height="h-32" />
        <ChartCardSkeleton height="h-40" />
        <ChartCardSkeleton height="h-40" />
      </div>
    );

  const parents = cats.filter((c) => !c.parentId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold">Settings</h1>
        <p className="text-sm text-[#94A3B8]">Budget, categories, limits, salary, security and data</p>
      </div>

      <HowItWorks />
      <SyncProblems />
      <BudgetFrameworkCard
        settings={settings}
        onSaved={(m) => {
          flash(m);
          load();
        }}
      />

      <Card title="Categories & limits">
        <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
          {parents.map((p) => (
            <div key={p.id} className="rounded-xl border border-[#263449] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="input flex-1 min-w-[140px]"
                  defaultValue={p.name}
                  onBlur={(e) =>
                    api(`/api/categories/${p.id}`, { method: "PUT", json: { name: e.target.value } }).then(() =>
                      flash("Category updated"),
                    )
                  }
                />
                <select
                  className="input w-28"
                  defaultValue={p.bucket}
                  onChange={(e) =>
                    api(`/api/categories/${p.id}`, { method: "PUT", json: { bucket: e.target.value } }).then(() =>
                      flash("Saved"),
                    )
                  }
                >
                  <option value="needs">Needs</option>
                  <option value="wants">Wants</option>
                  <option value="none">None</option>
                </select>
                <select
                  className="input w-28"
                  defaultValue={p.limitMode ?? ""}
                  onChange={(e) =>
                    api(`/api/categories/${p.id}`, {
                      method: "PUT",
                      json: { limitMode: e.target.value || null },
                    }).then(() => flash("Saved"))
                  }
                >
                  <option value="">No limit</option>
                  <option value="fixed">Fixed ₹</option>
                  <option value="percent">% of salary</option>
                </select>
                <input
                  className="input w-28"
                  placeholder="Limit"
                  defaultValue={p.limitValue ?? ""}
                  onBlur={(e) =>
                    api(`/api/categories/${p.id}`, {
                      method: "PUT",
                      json: { limitValue: e.target.value === "" ? null : e.target.value },
                    }).then(() => flash("Limit saved"))
                  }
                />
                <button
                  className="text-xs text-[#EF4444]"
                  onClick={() =>
                    api(`/api/categories/${p.id}`, { method: "DELETE" }).then(() => {
                      flash("Category deleted");
                      load();
                    })
                  }
                >
                  Delete
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {cats
                  .filter((c) => c.parentId === p.id)
                  .map((c) => (
                    <span
                      key={c.id}
                      className="rounded-full border border-[#263449] px-3 py-1 text-xs text-[#94A3B8]"
                    >
                      {c.name}
                      <button
                        className="ml-2 text-[#EF4444]"
                        onClick={() =>
                          api(`/api/categories/${c.id}`, { method: "DELETE" }).then(() => {
                            flash("Removed");
                            load();
                          })
                        }
                      >
                        ✕
                      </button>
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <form
          className="mt-4 grid sm:grid-cols-4 gap-3 items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newCat.name.trim()) return;
            await api("/api/categories", {
              method: "POST",
              json: {
                name: newCat.name,
                parentId: newCat.parentId || null,
                bucket: newCat.bucket,
              },
            });
            setNewCat({ name: "", parentId: "", bucket: "needs" });
            flash("Category added");
            load();
          }}
        >
          <div>
            <label className="label">New category</label>
            <input
              className="input"
              value={newCat.name}
              onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Parent (optional)</label>
            <select
              className="input"
              value={newCat.parentId}
              onChange={(e) => setNewCat({ ...newCat, parentId: e.target.value })}
            >
              <option value="">Top level</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Bucket</label>
            <select
              className="input"
              value={newCat.bucket}
              onChange={(e) => setNewCat({ ...newCat, bucket: e.target.value })}
            >
              <option value="needs">Needs</option>
              <option value="wants">Wants</option>
            </select>
          </div>
          <button className="btn btn-primary">Add</button>
        </form>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Security">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/api/auth/password", { method: "POST", json: pwd });
                setPwd({ current: "", next: "" });
                flash("Password updated");
              } catch (err) {
                flash(err instanceof Error ? err.message : "Failed");
              }
            }}
          >
            <div>
              <label className="label">Current password</label>
              <input
                type="password"
                className="input"
                value={pwd.current}
                onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
              />
            </div>
            <div>
              <label className="label">New password (at least 10 characters)</label>
              <input
                type="password"
                className="input"
                value={pwd.next}
                onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
              />
            </div>
            <button className="btn btn-primary">Update password</button>
            <p className="text-xs text-[#94A3B8]">
              Sessions are HTTP-only cookies; passwords are salted and hashed with scrypt. Passkey /
              WebAuthn unlock can be layered on later without schema changes.
            </p>
          </form>
        </Card>

        <Card title="Data">
          <div className="space-y-3">
            <DeleteAllTransactionsButton onDone={flash} />
            <p className="text-xs text-[#94A3B8]">
              Excel and PDF exports are available on the Statements page.
            </p>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <AppLockCard />
        <BackupCard />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <DeleteAccountCard />
      </div>
      <Toast message={toast} />
    </div>
  );
}
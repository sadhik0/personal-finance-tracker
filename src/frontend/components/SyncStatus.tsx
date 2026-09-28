"use client";

import { useEffect, useState } from "react";
import { subscribeSyncStatus, wireSyncEngine, type SyncStatus as Status } from "@/frontend/lib/syncEngine";

export default function SyncStatus() {
  const [status, setStatus] = useState<Status>({ online: true, pending: 0, syncing: false, lastError: null });

  useEffect(() => {
    wireSyncEngine();
    return subscribeSyncStatus(setStatus);
  }, []);

  if (!status.online) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-2.5 py-1 text-[11px] text-[#F59E0B]">
        <Dot color="#F59E0B" /> Offline{status.pending > 0 ? ` · ${status.pending} saved on device` : ""}
      </span>
    );
  }
  if (status.pending > 0 || status.syncing) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FACC15]/40 bg-[#FACC15]/10 px-2.5 py-1 text-[11px] text-[#FACC15]">
        <Dot color="#FACC15" pulse /> {status.pending} change{status.pending === 1 ? "" : "s"} syncing…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#22C55E]/40 bg-[#22C55E]/10 px-2.5 py-1 text-[11px] text-[#22C55E]">
      <Dot color="#22C55E" /> Synced
    </span>
  );
}

function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span
      className={`h-1.5 w-1.5 rounded-full ${pulse ? "animate-pulse" : ""}`}
      style={{ background: color }}
    />
  );
}

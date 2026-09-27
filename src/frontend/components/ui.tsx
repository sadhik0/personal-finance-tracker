"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { inr } from "@/frontend/lib/client";
import type { buildReport } from "@/backend/services/report.service";

export type Report = Awaited<ReturnType<typeof buildReport>>;

export function Card({
  children,
  className = "",
  title,
  right,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  right?: ReactNode;
}) {
  return (
    <div className={`card p-4 sm:p-5 animate-fadeup ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="text-[15px] sm:text-lg font-semibold">{title}</h3>}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function useCountUp(value: number, duration = 700) {
  const [v, setV] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else prev.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return v;
}

export function KPI({
  label,
  value,
  tone = "neutral",
  sub,
  icon,
}: {
  label: string;
  value: number;
  tone?: "pos" | "neg" | "warn" | "neutral" | "accent";
  sub?: string;
  icon?: string;
}) {
  const animated = useCountUp(value);
  const color =
    tone === "pos"
      ? "text-[#22C55E]"
      : tone === "neg"
        ? "text-[#EF4444]"
        : tone === "warn"
          ? "text-[#F59E0B]"
          : tone === "accent"
            ? "text-[#8B5CF6]"
            : "text-[#F8FAFC]";
  return (
    <div className="card kpi-glow p-4 animate-fadeup">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#94A3B8]">{label}</span>
        {icon && <span className="text-sm opacity-70">{icon}</span>}
      </div>
      <div className={`mt-2 text-xl sm:text-2xl font-semibold tabular-nums ${color}`}>
        {inr(animated)}
      </div>
      {sub && <div className="mt-1 text-[11px] text-[#94A3B8]">{sub}</div>}
    </div>
  );
}

export function Bar({ pct, tone }: { pct: number; tone?: string }) {
  const color =
    tone ??
    (pct >= 100 ? "#EF4444" : pct >= 90 ? "#F59E0B" : pct >= 70 ? "#38BDF8" : "#22C55E");
  return (
    <div className="h-2 w-full rounded-full bg-[#0f1829] overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(pct, 100)}%`, background: color }}
      />
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fadeup">
      <div className="rounded-full bg-[#172033] border border-[#22C55E]/40 px-4 py-2 text-sm text-[#F8FAFC] shadow-xl">
        ✓ {message}
      </div>
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="py-8 text-center text-sm text-[#94A3B8]">{text}</div>;
}

export const fmtTip = (v: unknown) => inr(Number(v ?? 0));

export const TOOLTIP_STYLE = {
  background: "#172033",
  border: "1px solid #263449",
  borderRadius: 12,
};

export const CHART_COLORS = [
  "#38BDF8",
  "#8B5CF6",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#14B8A6",
  "#F472B6",
  "#A3E635",
  "#60A5FA",
  "#FB923C",
];
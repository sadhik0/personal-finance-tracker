"use client";

import {
  dashboardPeriodLabel,
  type DashboardKind,
  type DashboardPeriod,
  shiftDashboardPeriod,
} from "@/shared/dashboardPeriods";

const kinds: { value: DashboardKind; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "half", label: "Half year" },
];

export default function DashboardPeriodFilter({
  value,
  weeks,
  onChange,
  onWeeksChange,
}: {
  value: DashboardPeriod;
  weeks: number;
  onChange: (p: DashboardPeriod) => void;
  onWeeksChange: (n: number) => void;
}) {
  function changeKind(kind: DashboardKind) {
    if (kind === "all") {
      return onChange({ kind, key: "all" });
    }

    if (kind === "week") {
      return onChange({
        kind,
        key: new Date().toISOString().slice(0, 10),
      });
    }

    const now = new Date();

    const key =
      kind === "month"
        ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
        : kind === "quarter"
          ? `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`
          : `${now.getFullYear()}-H${now.getMonth() < 6 ? 1 : 2}`;

    onChange({ kind, key });
  }

  return (
    <div
      className="w-full max-w-full overflow-x-auto pb-1 sm:w-auto sm:overflow-visible"
      aria-label="Dashboard period filter"
    >
      <div className="flex min-w-max items-center justify-start gap-1 sm:justify-end">

        {/* Period type */}
        <select
          aria-label="Period type"
          className="
            input
            box-border
            !h-8
            !min-h-8
            !py-0
            !leading-none
            min-w-[96px]
            whitespace-nowrap
            px-1.5
            text-[11px]
            sm:min-w-[104px]
            sm:px-2
          "
          value={value.kind}
          onChange={(e) =>
            changeKind(e.target.value as DashboardKind)
          }
        >
          {kinds.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>

        {/* Week length */}
        {value.kind === "week" && (
          <select
            aria-label="Week length"
            className="
              input
              box-border
              !h-8
              !min-h-8
              !py-0
              !leading-none
              min-w-[78px]
              whitespace-nowrap
              px-1.5
              text-[11px]
              sm:min-w-[84px]
              sm:px-2
            "
            value={weeks}
            onChange={(e) =>
              onWeeksChange(Number(e.target.value))
            }
          >
            <option value={1}>1 week</option>
            <option value={2}>2 weeks</option>
          </select>
        )}

        {/* Previous / current / next period */}
        {value.kind !== "all" && (
          <>
            <button
              aria-label="Previous period"
              className="
                btn
                btn-ghost
                h-8
                shrink-0
                px-1.5
                text-xs
                sm:px-2
              "
              onClick={() =>
                onChange(shiftDashboardPeriod(value, -1))
              }
            >
              ←
            </button>

            <span
              className="
                flex
                h-8
                min-w-[118px]
                shrink-0
                items-center
                justify-center
                whitespace-nowrap
                rounded-lg
                border
                border-[#263449]
                px-1.5
                text-[11px]
                text-[#CBD5E1]
                sm:min-w-[126px]
                sm:px-2
              "
            >
              {dashboardPeriodLabel(value, weeks)}
            </span>

            <button
              aria-label="Next period"
              className="
                btn
                btn-ghost
                h-8
                shrink-0
                px-1.5
                text-xs
                sm:px-2
              "
              onClick={() =>
                onChange(shiftDashboardPeriod(value, 1))
              }
            >
              →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
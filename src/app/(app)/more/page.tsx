import Link from "next/link";

const LINKS = [
  { href: "/statements", label: "Statements", desc: "Income & expense, balance sheet, cash flow, export" },
  { href: "/accounts", label: "Accounts", desc: "Balances and per-account history" },
  { href: "/analytics", label: "Analytics", desc: "Trends, category and family support analysis" },
  { href: "/settings", label: "Settings", desc: "Budget, categories, limits, salary, security" },
];

export default function MorePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">More</h1>
      <div className="space-y-3">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="card block p-4">
            <p className="font-medium">{l.label}</p>
            <p className="text-xs text-[#94A3B8]">{l.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

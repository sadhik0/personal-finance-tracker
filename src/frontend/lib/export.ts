"use client";

import { api, inr, periodLabel } from "./client";
import { fetchAllTransactions } from "./fetchAll";
import type { Report } from "@/frontend/components/ui";

type Tx = {
  id: string;
  updatedAt: string;
  date: string;
  type: string;
  amount: string;
  description: string;
  categoryId: string | null;
  accountId: string | null;
  toAccountId: string | null;
};

/** Title/label for the period the report covers, e.g. "Q3 2026 (Jul–Sep)" or "September 2026". */
const reportTitle = (report: Report) => report.title ?? periodLabel(report.period);
const fileSlug = (report: Report) =>
  (report.label ?? report.period).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function exportExcel(report: Report) {
  const XLSX = await import("xlsx");
  const [txs, cats, accs] = await Promise.all([
    fetchAllTransactions<Tx>({ from: report.range.start, to: report.range.end }),
    api<{ id: string; name: string }[]>("/api/categories"),
    api<{ id: string; name: string }[]>("/api/accounts"),
  ]);
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const accName = new Map(accs.map((a) => [a.id, a.name]));

  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: unknown[]) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name.slice(0, 31));

  const k = report.kpi;
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      [`Personal Financial Analysis — ${reportTitle(report)}`],
      [`${report.range.start} to ${report.range.end}`],
      [],
      ["Income (salary & other)", k.income],
      ["Bank interest", k.interest],
      ["Expenses", k.expense],
      ["Investments", k.investment],
      ["Loan repayment", k.loanPayment],
      ["Family support received", k.familyIn],
      ["Family support given", k.familyOut],
      ["Savings", k.savings],
      ["Net cash flow", k.netCashFlow],
      ["Net position", report.balanceSheet.net],
      ["Budget plan", report.budget.frameworkLabel],
    ]),
    "Overview",
  );

  add(
    "Transactions",
    txs.map((t) => ({
      Date: t.date,
      Type: t.type,
      Category: t.categoryId ? catName.get(t.categoryId) ?? "" : "",
      Account: t.accountId ? accName.get(t.accountId) ?? "" : "",
      "To Account": t.toAccountId ? accName.get(t.toAccountId) ?? "" : "",
      Amount: Number(t.amount),
      Description: t.description,
    })),
  );
  add("Income Summary", report.statements.incomeExpense.income.map((i) => ({ Source: i.name, Amount: i.amount })));
  add("Expense Summary", report.statements.incomeExpense.expenses.map((e) => ({ Category: e.name, Amount: e.amount })));
  add(
    "Category Analysis",
    report.categories.flatMap((c) => [
      { Category: c.name, Subcategory: "", Amount: c.total },
      ...c.children.map((ch) => ({ Category: c.name, Subcategory: ch.name, Amount: ch.total })),
    ]),
  );
  add("Budget Framework", [
    ...report.budget.buckets.map((b) => ({
      Bucket: b.label,
      "Plan %": b.pct,
      Target: Math.round(b.target),
      Actual: Math.round(b.actual),
      [b.kind === "goal" ? "Achieved %" : "Used %"]: Math.round(b.progressPct),
    })),
    ...(report.budget.base === 0 ? [{ Note: "No salary recorded in this period" }] : []),
  ]);
  add(
    "Category Limits",
    report.limits.length
      ? report.limits.map((l) => ({ Category: l.name, Limit: l.limit, Spent: l.spent, "Used %": Math.round(l.pct) }))
      : [{ Note: "No personal limits configured yet" }],
  );
  add(
    "Monthly Summary",
    report.monthly.map((m) => ({
      Month: m.period,
      Income: m.income + m.interest,
      Expenses: m.expense,
      Investments: m.investment,
      "Loan repayment": m.loanPayment,
      "Family given": m.familyOut,
      "Family received": m.familyIn,
      Savings: m.savings,
      "Net cash flow": m.net,
    })),
  );
  add(
    "Family Support",
    report.monthly.map((m) => ({
      Month: m.period,
      Received: m.familyIn,
      Given: m.familyOut,
      Net: m.familyIn - m.familyOut,
    })),
  );
  add("Investments", report.monthly.map((m) => ({ Month: m.period, Contribution: m.investment })));
  add("Accounts", report.accounts.map((a) => ({ Account: a.name, Kind: a.kind, Balance: a.balance })));
  add("Loan", report.monthly.map((m) => ({ Month: m.period, Payment: m.loanPayment })));

  XLSX.writeFile(wb, `personal-financial-analysis-${fileSlug(report)}.xlsx`);
}

export async function exportPDF(report: Report, name: string) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  const k = report.kpi;

  doc.setFontSize(18);
  doc.text(`Personal Financial Statement — ${reportTitle(report)}`, 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text(`${report.range.start} to ${report.range.end} · ${name}`, 14, 27);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 34,
    head: [["Executive summary", "Amount"]],
    body: [
      ["Income (salary & other)", inr(k.income)],
      ["Bank interest", inr(k.interest)],
      ["Expenses", inr(k.expense)],
      ["Savings", inr(k.savings)],
      ["Investment contributions", inr(k.investment)],
      ["Loan payments", inr(k.loanPayment)],
      ["Net cash flow", inr(k.netCashFlow)],
      ["Savings rate", `${k.savingsRate.toFixed(1)}%`],
    ],
    theme: "striped",
    headStyles: { fillColor: [17, 24, 39] },
  });

  type Doc = typeof doc & { lastAutoTable: { finalY: number } };
  const y = () => (doc as Doc).lastAutoTable.finalY + 8;

  autoTable(doc, {
    startY: y(),
    head: [[`Budget (${report.budget.frameworkLabel})`, "Plan %", "Target", "Actual", "Used / achieved"]],
    body: report.budget.buckets.map((b) => [
      b.label,
      `${b.pct}%`,
      inr(b.target),
      inr(b.actual),
      `${b.progressPct.toFixed(0)}%`,
    ]),
    headStyles: { fillColor: [17, 24, 39] },
  });

  if (report.monthly.length > 1) {
    autoTable(doc, {
      startY: y(),
      head: [["Month", "Income", "Expenses", "Investments", "Loan", "Savings"]],
      body: report.monthly.map((m) => [
        m.period,
        inr(m.income + m.interest),
        inr(m.expense),
        inr(m.investment),
        inr(m.loanPayment),
        inr(m.savings),
      ]),
      foot: [
        [
          `${report.label ?? "Total"} total`,
          inr(k.income + k.interest),
          inr(k.expense),
          inr(k.investment),
          inr(k.loanPayment),
          inr(k.savings),
        ],
      ],
      headStyles: { fillColor: [17, 24, 39] },
      footStyles: { fillColor: [226, 232, 240], textColor: 20 },
    });
    const hs = report.summary.highestSpendingMonth;
    const ls = report.summary.lowestSpendingMonth;
    autoTable(doc, {
      startY: y(),
      head: [["Period summary", "Value"]],
      body: [
        ["Average monthly spending", inr(report.summary.avgMonthlySpending)],
        ["Average monthly savings", inr(report.summary.avgMonthlySavings)],
        ["Highest spending month", hs ? `${hs.period} · ${inr(hs.amount)}` : "—"],
        ["Lowest spending month", ls ? `${ls.period} · ${inr(ls.amount)}` : "—"],
      ],
      headStyles: { fillColor: [17, 24, 39] },
    });
  }

  autoTable(doc, {
    startY: y(),
    head: [["Expense category", "Amount"]],
    body: report.categories.map((c) => [c.name, inr(c.total)]),
    headStyles: { fillColor: [17, 24, 39] },
  });

  autoTable(doc, {
    startY: y(),
    head: [["Family support", "Amount"]],
    body: [
      ["Received", inr(k.familyIn)],
      ["Given", inr(k.familyOut)],
      ["Net", inr(k.netFamily)],
    ],
    headStyles: { fillColor: [17, 24, 39] },
  });

  autoTable(doc, {
    startY: y(),
    head: [["Account", "Kind", "Balance"]],
    body: report.accounts.map((a) => [a.name, a.kind, inr(a.balance)]),
    headStyles: { fillColor: [17, 24, 39] },
  });

  autoTable(doc, {
    startY: y(),
    head: [["Net position", "Amount"]],
    body: [
      ["Total assets", inr(report.balanceSheet.assets)],
      ["Total liabilities", inr(report.balanceSheet.liabilities)],
      ["Net position", inr(report.balanceSheet.net)],
    ],
    headStyles: { fillColor: [17, 24, 39] },
  });

  if (report.alerts.length) {
    autoTable(doc, {
      startY: y(),
      head: [["Observations"]],
      body: report.alerts.map((a) => [a.text]),
      headStyles: { fillColor: [17, 24, 39] },
    });
  }

  doc.save(`personal-financial-statement-${fileSlug(report)}.pdf`);
}

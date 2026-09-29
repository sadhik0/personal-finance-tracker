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

export async function exportExcel(report: Report, period: string) {
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
  add(
    "Budget vs Actual",
    report.limits.length
      ? report.limits.map((l) => ({ Category: l.name, Limit: l.limit, Spent: l.spent, "Used %": Math.round(l.pct) }))
      : [{ Note: "No personal limits configured yet" }],
  );
  add("Monthly Summary", report.trend);
  add(
    "Family Support",
    report.trend.map((t) => ({
      Month: t.period,
      Received: t.familyIn,
      Given: t.familyOut,
      Net: t.familyIn - t.familyOut,
    })),
  );
  add("Investments", report.trend.map((t) => ({ Month: t.period, Contribution: t.investment })));
  add("Accounts", report.accounts.map((a) => ({ Account: a.name, Kind: a.kind, Balance: a.balance })));
  add("Loan", report.trend.map((t) => ({ Month: t.period, Payment: t.loanPayment })));

  XLSX.writeFile(wb, `finance-report-${period}.xlsx`);
}

export async function exportPDF(report: Report, period: string, name: string) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  const k = report.kpi;

  doc.setFontSize(18);
  doc.text("Personal Financial Report", 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text(`${periodLabel(period)} · ${name}`, 14, 27);
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
    head: [["Budget (50/30/20)", "Target", "Actual", "Actual %"]],
    body: (["needs", "wants", "savings"] as const).map((b) => [
      b.toUpperCase(),
      inr(report.budget.targets[b]),
      inr(report.budget.actual[b]),
      `${report.budget.actualPct[b].toFixed(1)}%`,
    ]),
    headStyles: { fillColor: [17, 24, 39] },
  });

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

  doc.save(`finance-report-${period}.pdf`);
}

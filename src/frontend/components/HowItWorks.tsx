"use client";
const sections = [
  ["Dashboard periods", "The dashboard can show All time, weekly, monthly, quarterly, or half-yearly data. Longer periods combine transactions in the selected date range."],
  ["Income and in-hand salary", "Income means the salary or in-hand income you record. The budget base uses in-hand income, not family support or bank interest."],
  ["Savings", "Savings = in-hand income + bank interest − expenses − family support given − loan repayments. Investments, PF, and family support received are tracked separately."],
  ["Net cash flow", "Net cash flow = income + interest + family support received − expenses − family support given − loan repayments − investment contributions. It is period movement, not current bank balance."],
  ["Investments", "Investment contributions are tracked separately because the money moves into investments rather than remaining in bank or cash accounts."],
  ["PF", "Income is recorded as in-hand salary after PF deductions. PF contributions are tracked separately and do not reduce the bank account again."],
  ["Loan repayment and interest", "Loan repayments reduce cash flow and savings. Loan interest accrual changes the loan balance but is not treated as cash movement."],
  ["Family support", "Family support received increases cash flow but is not salary-based savings. Family support given reduces savings and cash flow and remains separately visible."],
  ["Transfers", "Transfers move money between your own accounts. They are wealth-neutral and should not be counted as income or expense."],
  ["Finance plans and budgets", "A finance plan can change by month. When a period contains different plans, targets are combined month by month. Actual transactions are not changed."],
] as const;
export default function HowItWorks() { return <details className="card p-4 sm:p-5"><summary className="cursor-pointer text-[15px] font-semibold">How it works</summary><p className="mt-2 text-xs text-[#94A3B8]">Open a topic to understand how the app calculates and classifies your finances.</p><div className="mt-3 space-y-2">{sections.map(([title, text]) => <details key={title} className="rounded-xl border border-[#263449] px-3 py-2"><summary className="cursor-pointer text-sm text-[#E2E8F0]">{title}</summary><p className="mt-2 text-xs leading-5 text-[#94A3B8]">{text}</p></details>)}</div></details>; }

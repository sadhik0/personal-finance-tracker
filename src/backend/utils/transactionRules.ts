import { Account } from "@/backend/models";
import { InputError } from "./validate";

/**
 * Enforce the accounting roles used by the balance engine:
 * - loan_interest_accrual: no source account; destination must be a loan.
 * - loan_repayment: source must be non-loan; destination must be a loan.
 */
export async function validateTransactionAccountRoles(
  userId: string,
  type: string,
  accountId: string | null,
  toAccountId: string | null,
) {
  if (type === "loan_interest_accrual") {
    if (accountId) throw new InputError("Loan interest accrual must not have a source account");
    if (!toAccountId) throw new InputError("Loan interest accrual must target a loan account");
    const loan = await Account.findOne({ _id: toAccountId, userId }).select({ kind: 1 });
    if (!loan) throw new InputError("Loan account not found");
    if (loan.kind !== "loan") throw new InputError("Loan interest accrual must target a loan account");
    return;
  }

  if (type === "loan_repayment") {
    if (!accountId) throw new InputError("Loan repayment must have a payment account");
    if (!toAccountId) throw new InputError("Loan repayment must target a loan account");
    const [source, loan] = await Promise.all([
      Account.findOne({ _id: accountId, userId }).select({ kind: 1 }),
      Account.findOne({ _id: toAccountId, userId }).select({ kind: 1 }),
    ]);
    if (!source) throw new InputError("Payment account not found");
    if (!loan) throw new InputError("Loan account not found");
    if (source.kind === "loan") throw new InputError("Loan repayment must come from a bank, cash, or other non-loan account");
    if (loan.kind !== "loan") throw new InputError("Loan repayment must target a loan account");
  }
}

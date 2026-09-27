import { connectToDatabase } from "@/backend/db/connect";
import { Account, Category, Transaction } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";
import { currentPeriod, shiftPeriod } from "@/backend/services/finance.service";

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length];
}

export async function POST() {
  return withUser(async (user) => {
    await connectToDatabase();
    const accs = await Account.find({ userId: user.id });
    const cats = await Category.find({ userId: user.id });
    const acc = (name: string) => accs.find((a) => a.name === name)?.id ?? null;
    const cat = (name: string) => cats.find((c) => c.name === name)?.id ?? null;

    const bank = acc("Salary Account");
    const savings = acc("Savings Account");
    const cash = acc("Cash");
    const invest = acc("Investments");
    const pf = acc("PF");
    const loan = acc("Education Loan");

    await Transaction.deleteMany({ userId: user.id });

    const rows: Record<string, unknown>[] = [];
    const push = (
      type: string,
      amount: number,
      date: string,
      description: string,
      categoryId: string | null = null,
      accountId: string | null = bank,
      toAccountId: string | null = null,
      meta: unknown = null,
    ) =>
      rows.push({
        userId: user.id,
        type,
        amount,
        date,
        description,
        categoryId,
        accountId,
        toAccountId,
        meta,
      });

    const foods = ["Lunch", "Dinner", "Coffee", "Groceries", "Snacks", "Restaurant"];
    const travels = ["Bus", "Metro", "Auto", "Petrol"];
    const shops = ["Clothing", "Electronics", "Personal Care", "Household"];

    for (let i = 3; i >= 0; i--) {
      const p = shiftPeriod(currentPeriod(), -i);
      const d = (day: number) => `${p}-${String(day).padStart(2, "0")}`;
      const salary = 42000 + i * 500;
      push("income", salary, d(1), "Monthly salary", cat("Salary"));
      push("interest", 180 + i * 12, d(2), "Savings account interest");
      push("pf", 2400, d(1), "Employee PF contribution", null, null, pf, { share: "employee" });
      push("pf", 2400, d(1), "Employer PF contribution", null, null, pf, { share: "employer" });
      push("expense", 8000, d(3), "Hostel rent", cat("Hostel Rent"));
      push("loan_repayment", 5000, d(5), "Education loan payment", null, bank, loan);
      push("investment", 6000, d(6), "SIP contribution", null, bank, invest);
      push("transfer", 4000, d(6), "Bank to savings", null, bank, savings);
      push("transfer", 2000, d(7), "ATM withdrawal", null, bank, cash);
      push("family_in", i % 2 === 0 ? 5000 : 3000, d(8), "Support from family");
      push("family_out", 3500 + i * 250, d(12), "Money sent home");
      for (let k = 0; k < 12; k++) {
        push(
          "expense",
          150 + ((k * 73 + i * 31) % 500),
          d(4 + k * 2),
          `${pick(foods, k + i)} expense`,
          cat(pick(foods, k + i)),
          k % 3 === 0 ? cash : bank,
        );
      }
      for (let k = 0; k < 5; k++) {
        push(
          "expense",
          60 + ((k * 37 + i * 11) % 400),
          d(5 + k * 4),
          `${pick(travels, k + i)} fare`,
          cat(pick(travels, k + i)),
        );
      }
      for (let k = 0; k < 3; k++) {
        push(
          "expense",
          500 + ((k * 411 + i * 97) % 1800),
          d(9 + k * 6),
          `${pick(shops, k + i)} purchase`,
          cat(pick(shops, k + i)),
        );
      }
      push("expense", 499, d(14), "Streaming subscription", cat("Subscriptions"));
      push("expense", 350, d(18), "Medicine", cat("Medicine"));
    }

    await Transaction.insertMany(rows);
    return ok({ inserted: rows.length });
  });
}

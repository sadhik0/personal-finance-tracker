import { connectToDatabase } from "@/backend/db/connect";
import { Account, Category, ExpectedRule, Settings } from "@/backend/models";

const DEFAULT_ACCOUNTS: { name: string; kind: string }[] = [
  { name: "Salary Account", kind: "bank" },
  { name: "Savings Account", kind: "bank" },
  { name: "Cash", kind: "cash" },
  { name: "Investments", kind: "investment" },
  { name: "PF", kind: "pf" },
  { name: "Education Loan", kind: "loan" },
];

const DEFAULT_CATEGORIES: {
  name: string;
  bucket: string;
  type?: string;
  children?: string[];
}[] = [
  {
    name: "Food",
    bucket: "needs",
    children: ["Breakfast", "Lunch", "Dinner", "Snacks", "Coffee", "Restaurant", "Groceries"],
  },
  {
    name: "Travel",
    bucket: "needs",
    children: ["Bus", "Metro", "Auto", "Taxi", "Train", "Petrol", "Parking", "Toll"],
  },
  {
    name: "Shopping",
    bucket: "wants",
    children: ["Clothing", "Electronics", "Personal Care", "Household", "Other"],
  },
  { name: "Housing", bucket: "needs", children: ["Hostel Rent", "Utilities", "Maintenance"] },
  { name: "Health", bucket: "needs", children: ["Medicine", "Doctor", "Insurance"] },
  { name: "Entertainment", bucket: "wants", children: ["Subscriptions", "Movies", "Outings"] },
  { name: "Education", bucket: "needs", children: ["Courses", "Books"] },
  { name: "Salary", bucket: "none", type: "income" },
  { name: "Other Income", bucket: "none", type: "income" },
];

export async function seedDefaults(userId: string) {
  await connectToDatabase();

  await Settings.updateOne({ userId }, { $setOnInsert: { userId } }, { upsert: true });

  const createdAccounts = await Account.insertMany(
    DEFAULT_ACCOUNTS.map((a, i) => ({
      userId,
      name: a.name,
      kind: a.kind,
      sortOrder: i,
    })),
  );

  let order = 0;
  for (const c of DEFAULT_CATEGORIES) {
    const parent = await Category.create({
      userId,
      name: c.name,
      bucket: c.bucket,
      type: c.type ?? "expense",
      sortOrder: order++,
    });
    if (c.children?.length) {
      await Category.insertMany(
        c.children.map((child, i) => ({
          userId,
          parentId: parent._id,
          name: child,
          bucket: c.bucket,
          type: c.type ?? "expense",
          sortOrder: i,
        })),
      );
    }
  }

  const salaryAcc = createdAccounts.find((a) => a.name === "Salary Account");
  const loanAcc = createdAccounts.find((a) => a.name === "Education Loan");
  await ExpectedRule.insertMany([
    {
      userId,
      kind: "salary",
      label: "Monthly Salary",
      amount: null,
      dayOfMonth: 30,
      accountId: salaryAcc?._id ?? null,
      active: true,
    },
    {
      userId,
      kind: "interest",
      label: "Bank Interest",
      amount: null,
      dayOfMonth: 1,
      accountId: salaryAcc?._id ?? null,
      active: false,
    },
    {
      userId,
      kind: "loan_interest",
      label: "Education Loan Interest",
      amount: null,
      ratePct: 10,
      dayOfMonth: 1,
      accountId: loanAcc?._id ?? null,
      active: false,
    },
  ]);
}
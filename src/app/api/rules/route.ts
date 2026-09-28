import { connectToDatabase } from "@/backend/db/connect";
import { Account, ExpectedRule } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";
import { bool, idOrNull, num, oneOf, readJson, text } from "@/backend/utils/validate";
import { mustOwn } from "@/backend/utils/ownership";

const RULE_KINDS = ["salary", "interest", "loan_interest"] as const;

export async function GET() {
  return withUser(async (user) => {
    await connectToDatabase();
    const rows = await ExpectedRule.find({ userId: user.id }).sort({ _id: 1 });
    return ok(rows);
  });
}

export async function POST(req: Request) {
  return withUser(async (user) => {
    await connectToDatabase();
    const b = await readJson(req);
    const accountId = await mustOwn(Account, user.id, idOrNull(b.accountId, "accountId"), "Account");
    const row = await ExpectedRule.create({
      userId: user.id,
      kind: oneOf(b.kind, "Kind", RULE_KINDS, "salary"),
      label: text(b.label, "Label", { max: 100 }),
      amount: b.amount ? num(b.amount, "Amount", { min: 0 }) : null,
      dayOfMonth: b.dayOfMonth === undefined ? 30 : Math.round(num(b.dayOfMonth, "Day of month", { min: 1, max: 31 })),
      accountId,
      active: b.active === undefined ? true : bool(b.active, "active"),
    });
    return ok(row);
  });
}

import { connectToDatabase } from "@/backend/db/connect";
import { Account, Category, Transaction } from "@/backend/models";
import { ok, withUser } from "@/backend/utils/response";
import { TX_TYPES } from "@/backend/services/finance.service";
import {
  clientIdOrNull,
  idOrNull,
  isoDate,
  metaOrNull,
  oneOf,
  positive,
  readJson,
  text,
} from "@/backend/utils/validate";
import { ownedOrNull } from "@/backend/utils/ownership";
import { validateTransactionAccountRoles } from "@/backend/utils/transactionRules";

export async function GET(req: Request) {
  return withUser(async (user) => {
    await connectToDatabase();
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const type = url.searchParams.get("type");
    const categoryId = idOrNull(url.searchParams.get("categoryId"), "categoryId");
    const accountId = idOrNull(url.searchParams.get("accountId"), "accountId");
    const q = url.searchParams.get("q");
    const updatedSince = url.searchParams.get("updatedSince");
    const limit = Math.min(Math.max(Math.floor(Number(url.searchParams.get("limit"))) || 500, 1), 2000);

    const filter: Record<string, unknown> = { userId: user.id, deletedAt: null };
    if (updatedSince) {
      const since = new Date(updatedSince);
      if (!Number.isNaN(since.getTime())) filter.updatedAt = { $gt: since };
    }
    if (from || to) {
      filter.date = {
        ...(from ? { $gte: isoDate(from, "from") } : {}),
        ...(to ? { $lte: isoDate(to, "to") } : {}),
      };
    }
    if (type) filter.type = oneOf(type, "type", TX_TYPES);
    if (categoryId) filter.categoryId = categoryId;
    if (accountId) filter.accountId = accountId;
    if (q) {
      const literal = q.slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.description = { $regex: literal, $options: "i" };
    }

    const rows = await Transaction.find(filter)
      .sort({ date: -1, _id: -1 })
      .limit(limit);
    return ok(rows);
  });
}

export async function POST(req: Request) {
  return withUser(async (user) => {
    await connectToDatabase();
    const b = await readJson(req);
    const clientId = clientIdOrNull(b.clientId);
    const [categoryId, accountId, toAccountId] = await Promise.all([
      ownedOrNull(Category, user.id, idOrNull(b.categoryId, "categoryId")),
      ownedOrNull(Account, user.id, idOrNull(b.accountId, "accountId")),
      ownedOrNull(Account, user.id, idOrNull(b.toAccountId, "toAccountId")),
    ]);
    const type = oneOf(b.type, "type", TX_TYPES, "expense");
    await validateTransactionAccountRoles(user.id, type, accountId, toAccountId);
    const doc = {
      userId: user.id,
      type,
      amount: positive(b.amount, "Amount"),
      date: b.date === undefined ? new Date().toISOString().slice(0, 10) : isoDate(b.date, "Date"),
      categoryId,
      accountId,
      toAccountId,
      description: text(b.description, "Description", { max: 500, clip: true }),
      meta: metaOrNull(b.meta),
      updatedAt: new Date(),
      ...(clientId ? { clientId } : {}),
    };
    // Upsert on (userId, clientId) when a clientId is supplied (offline sync
    // queue retries) so a retried create can never produce a duplicate row.
    const row = clientId
      ? await Transaction.findOneAndUpdate(
          { userId: user.id, clientId },
          { $setOnInsert: doc },
          { new: true, upsert: true },
        )
      : await Transaction.create(doc);
    return ok(row);
  });
}

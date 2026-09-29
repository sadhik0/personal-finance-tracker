import mongoose, { Schema } from "mongoose";
import { applyJsonTransform } from "./toJSON";

/**
 * type: income | expense | transfer | investment | loan_repayment |
 *       family_in | family_out | interest | pf
 */
const transactionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: String, required: true }, // stored as "YYYY-MM-DD"
  categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
  accountId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  toAccountId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  description: { type: String, required: true, default: "" },
  meta: { type: Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  /** Set by the client at creation time (crypto.randomUUID()). Lets the
   * offline sync queue retry a create safely without producing duplicates —
   * the API upserts on (userId, clientId) instead of always inserting. */
  clientId: { type: String },
  /** Soft-delete so an offline device that deleted a row can propagate that
   * deletion once it reconnects, instead of the row just disappearing. */
  deletedAt: { type: Date, default: null },
});

// Speeds up the common "my transactions in a date range" queries.
transactionSchema.index({ userId: 1, deletedAt: 1, date: -1 });

// Cursor pagination (export / backup): ordered by updatedAt, ties broken by _id.
transactionSchema.index({ userId: 1, updatedAt: 1, _id: 1 });

// Partial index: only rows that actually have a string clientId are
// constrained, so normal online creates (no clientId) never collide.
transactionSchema.index(
  { userId: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: "string" } } },
);

applyJsonTransform(transactionSchema);

export const Transaction =
  mongoose.models.Transaction ?? mongoose.model("Transaction", transactionSchema);

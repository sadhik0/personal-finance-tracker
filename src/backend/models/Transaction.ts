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
});

applyJsonTransform(transactionSchema);

export const Transaction =
  mongoose.models.Transaction ?? mongoose.model("Transaction", transactionSchema);

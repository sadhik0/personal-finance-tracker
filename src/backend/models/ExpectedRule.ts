import mongoose, { Schema } from "mongoose";
import { applyJsonTransform } from "./toJSON";

/** kind: salary | interest | loan_interest */
const expectedRuleSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  kind: { type: String, required: true },
  label: { type: String, required: true, default: "" },
  amount: { type: Number, default: null },
  /** used when kind === "loan_interest": monthly compounding rate, e.g. 10 = 10% */
  ratePct: { type: Number, default: null },
  dayOfMonth: { type: Number, required: true, default: 30 },
  accountId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  active: { type: Boolean, required: true, default: true },
  /** last "YYYY-MM" period handled (confirmed or skipped) */
  lastHandledPeriod: { type: String, default: null },
});

applyJsonTransform(expectedRuleSchema);

export const ExpectedRule =
  mongoose.models.ExpectedRule ?? mongoose.model("ExpectedRule", expectedRuleSchema);
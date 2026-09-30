import mongoose, { Schema } from "mongoose";
import { applyJsonTransform } from "./toJSON";

/** One effective-dated budget plan: applies from month `from` (YYYY-MM) onward. */
const planEntrySchema = new Schema(
  {
    from: { type: String, required: true },
    framework: { type: String, required: true, default: "standard" },
    needs: { type: Number, required: true },
    wants: { type: Number, required: true },
    loan: { type: Number, required: true, default: 0 },
    savings: { type: Number, required: true },
  },
  { _id: false },
);

const settingsSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  currency: { type: String, required: true, default: "INR" },
  needsPct: { type: Number, required: true, default: 50 },
  wantsPct: { type: Number, required: true, default: 30 },
  savingsPct: { type: Number, required: true, default: 20 },
  customNeedsPct: { type: Number, default: null },
  customWantsPct: { type: Number, default: null },
  customSavingsPct: { type: Number, default: null },
  /** Budget plan history (see src/shared/budget.ts). Empty = use the legacy fields above. */
  planHistory: { type: [planEntrySchema], default: [] },
  theme: { type: String, required: true, default: "dark" },
});

applyJsonTransform(settingsSchema);

export const Settings = mongoose.models.Settings ?? mongoose.model("Settings", settingsSchema);

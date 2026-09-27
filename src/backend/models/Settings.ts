import mongoose, { Schema } from "mongoose";
import { applyJsonTransform } from "./toJSON";

const settingsSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  currency: { type: String, required: true, default: "INR" },
  needsPct: { type: Number, required: true, default: 50 },
  wantsPct: { type: Number, required: true, default: 30 },
  savingsPct: { type: Number, required: true, default: 20 },
  customNeedsPct: { type: Number, default: null },
  customWantsPct: { type: Number, default: null },
  customSavingsPct: { type: Number, default: null },
  theme: { type: String, required: true, default: "dark" },
});

applyJsonTransform(settingsSchema);

export const Settings = mongoose.models.Settings ?? mongoose.model("Settings", settingsSchema);

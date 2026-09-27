import mongoose, { Schema } from "mongoose";
import { applyJsonTransform } from "./toJSON";

/** bucket: needs | wants | savings | none */
const categorySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  parentId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
  name: { type: String, required: true },
  bucket: { type: String, required: true, default: "needs" },
  type: { type: String, required: true, default: "expense" },
  disabled: { type: Boolean, required: true, default: false },
  sortOrder: { type: Number, required: true, default: 0 },
  /** limit config: null | "fixed" | "percent" (paired with limitValue) */
  limitMode: { type: String, default: null },
  limitValue: { type: Number, default: null },
});

applyJsonTransform(categorySchema);

export const Category = mongoose.models.Category ?? mongoose.model("Category", categorySchema);

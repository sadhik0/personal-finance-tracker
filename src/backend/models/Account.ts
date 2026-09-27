import mongoose, { Schema } from "mongoose";
import { applyJsonTransform } from "./toJSON";

/** kind: bank | cash | investment | pf | loan */
const accountSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true },
  kind: { type: String, required: true, default: "bank" },
  openingBalance: { type: Number, required: true, default: 0 },
  archived: { type: Boolean, required: true, default: false },
  sortOrder: { type: Number, required: true, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

applyJsonTransform(accountSchema);

export const Account = mongoose.models.Account ?? mongoose.model("Account", accountSchema);

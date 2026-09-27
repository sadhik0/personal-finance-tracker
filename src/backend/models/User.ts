import mongoose, { Schema } from "mongoose";
import { applyJsonTransform } from "./toJSON";

const userSchema = new Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  displayName: { type: String, required: true, default: "User" },
  passwordHash: { type: String, required: true },
  pinHash: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

applyJsonTransform(userSchema);

export type UserDoc = mongoose.Document & {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  pinHash: string | null;
  createdAt: Date;
};

export const User = mongoose.models.User ?? mongoose.model("User", userSchema);

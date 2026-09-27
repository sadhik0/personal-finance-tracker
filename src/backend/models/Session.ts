import mongoose, { Schema } from "mongoose";
import { applyJsonTransform } from "./toJSON";

// The session id itself (a random token) is used as the Mongo _id, so we
// don't need a separate "sessionId" field.
const sessionSchema = new Schema({
  _id: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  userAgent: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});

applyJsonTransform(sessionSchema);

export const Session = mongoose.models.Session ?? mongoose.model("Session", sessionSchema);

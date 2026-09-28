import mongoose, { Schema } from "mongoose";

/** One row per rate-limit bucket (e.g. "login:1.2.3.4:sadhik"). MongoDB
 * deletes expired rows itself through the TTL index on resetAt. */
const rateLimitSchema = new Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 1 },
  resetAt: { type: Date, required: true },
});
rateLimitSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit = mongoose.models.RateLimit ?? mongoose.model("RateLimit", rateLimitSchema);

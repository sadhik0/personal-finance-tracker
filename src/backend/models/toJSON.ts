import mongoose, { Schema } from "mongoose";

/**
 * Attaches a `toJSON` transform to a schema so that when a document is sent
 * back to the frontend as JSON it looks nice and beginner-friendly:
 *   - `_id`      -> `id` (as a plain string)
 *   - any ObjectId field (userId, categoryId, accountId, ...) -> plain string
 *   - `__v`      -> removed (Mongoose's internal version key)
 *
 * This keeps the rest of the app (frontend + services) working with simple
 * string ids instead of having to deal with Mongo's ObjectId type everywhere.
 */
export function applyJsonTransform(schema: Schema) {
  schema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      if (ret._id !== undefined) {
        ret.id = String(ret._id);
        delete ret._id;
      }
      for (const key of Object.keys(ret)) {
        const value = ret[key];
        if (value instanceof mongoose.Types.ObjectId) {
          ret[key] = value.toString();
        }
      }
      return ret;
    },
  });
}

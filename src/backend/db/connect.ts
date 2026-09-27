import mongoose from "mongoose";

/**
 * This file opens (and re-uses) one connection to your MongoDB database.
 *
 * Set MONGODB_URI in your `.env.local` file, e.g. for MongoDB Atlas:
 *   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/finance-tracker
 *
 * Next.js reloads files often during development, so we cache the
 * connection on `global` to avoid opening a new one on every request.
 */

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is required. Add it to your .env.local file.");
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  __mongooseCache?: MongooseCache;
};

const cache: MongooseCache = globalForMongoose.__mongooseCache ?? {
  conn: null,
  promise: null,
};
globalForMongoose.__mongooseCache = cache;

export async function connectToDatabase() {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI as string).then((m) => m);
  }
  cache.conn = await cache.promise;
  return cache.conn;
}

import mongoose from "mongoose";

// Accepts either name — some environments (e.g. Vercel) may still have the
// connection string saved under the old MONGODB_URI_MONGODB_URI typo'd key
// from before that was fixed in code. Checking both means the app connects
// either way, without anyone having to go rename anything in a dashboard.
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URI_MONGODB_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global.mongooseCache ?? { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cache;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) {
    return cache.conn;
  }

  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI (or MONGODB_URI_MONGODB_URI) is not set. Add it to .env.local before making database calls."
    );
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 10,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }

  return cache.conn;
}

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/backend/db/connect";
import { Session, User } from "@/backend/models";
import type { UserDoc } from "@/backend/models/User";

export const SESSION_COOKIE = "pft_session";
/** Minimum length for NEW passwords (existing passwords keep working). */
export const MIN_PASSWORD = 10;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export async function createSession(userId: string, userAgent = "") {
  await connectToDatabase();
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await Session.create({ _id: id, userId, userAgent, expiresAt });
  const store = await cookies();
  store.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return id;
}

export async function destroySession() {
  await connectToDatabase();
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (id) await Session.deleteOne({ _id: id });
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<UserDoc | null> {
  await connectToDatabase();
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const session = await Session.findOne({ _id: id, expiresAt: { $gt: new Date() } });
  if (!session) return null;
  const user = await User.findById(session.userId);
  return (user as UserDoc | null) ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

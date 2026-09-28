import { connectToDatabase } from "@/backend/db/connect";
import { User } from "@/backend/models";
import { bad, ok, withUser } from "@/backend/utils/response";
import { hashPassword, verifyPassword } from "@/backend/services/auth.service";

/**
 * The PIN is verified locally on-device (so app-lock works offline) — this
 * route only exists so the PIN survives a reinstall / new device: the hash
 * is pushed here when set, and pulled down via /api/auth/me on login.
 */
export async function POST(req: Request) {
  return withUser(async (user) => {
    await connectToDatabase();
    const b = await req.json();
    const pin = String(b.pin ?? "");
    if (!/^\d{4,8}$/.test(pin)) return bad("PIN must be 4-8 digits");
    await User.updateOne({ _id: user.id }, { $set: { pinHash: hashPassword(pin) } });
    return ok({ ok: true });
  });
}

export async function DELETE() {
  return withUser(async (user) => {
    await connectToDatabase();
    await User.updateOne({ _id: user.id }, { $set: { pinHash: null } });
    return ok({ ok: true });
  });
}

/** Lets a device that still has a valid session but no local PIN cache yet
 * (e.g. reinstalled the PWA) confirm the PIN against the server copy while
 * online. On success the client derives and caches its own local verifier
 * from that same PIN — the server's hash format never needs to travel. */
export async function PUT(req: Request) {
  return withUser(async (user) => {
    await connectToDatabase();
    const b = await req.json();
    if (!user.pinHash) return bad("No PIN set", 404);
    const okPin = verifyPassword(String(b.pin ?? ""), user.pinHash);
    if (!okPin) return bad("Incorrect PIN", 401);
    return ok({ ok: true });
  });
}

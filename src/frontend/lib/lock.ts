import db from "./db";
import { api } from "./client";

const ITERATIONS = 150_000;

function bytesToHex(b: Uint8Array) {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(hex: string) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function derive(pin: string, saltHex: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

async function getSetting(key: string): Promise<string | null> {
  const row = await db.settings.get(key);
  return (row?.value as string) ?? null;
}
async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value });
}

export async function hasLocalPin(): Promise<boolean> {
  return (await getSetting("pinHash")) !== null;
}

export async function setPin(pin: string): Promise<void> {
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await derive(pin, salt);
  await setSetting("pinSalt", salt);
  await setSetting("pinHash", hash);
  await setSetting("lockEnabled", true);
  try {
    await api("/api/auth/pin", { method: "POST", json: { pin } });
  } catch {
    // Local lock is already active regardless — server copy (used for
    // cross-device recovery) will just be missing until next time online.
  }
}

export async function verifyLocalPin(pin: string): Promise<boolean> {
  const salt = await getSetting("pinSalt");
  const stored = await getSetting("pinHash");
  if (!salt || !stored) return false;
  const candidate = await derive(pin, salt);
  return candidate === stored;
}

/** For a device with no local PIN cached yet, but the account has one set
 * (server hasPin=true): confirm the typed PIN against the server, then
 * cache this device's own local verifier from it. Requires connectivity. */
export async function confirmPinOnNewDevice(pin: string): Promise<boolean> {
  await api("/api/auth/pin", { method: "PUT", json: { pin } }); // throws on wrong PIN / no connection
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await derive(pin, salt);
  await setSetting("pinSalt", salt);
  await setSetting("pinHash", hash);
  await setSetting("lockEnabled", true);
  return true;
}

export async function clearPin(): Promise<void> {
  await db.settings.bulkDelete(["pinSalt", "pinHash", "lockEnabled"]);
  try {
    await api("/api/auth/pin", { method: "DELETE" });
  } catch {
    /* best-effort */
  }
}

export async function isLockEnabled(): Promise<boolean> {
  return (await db.settings.get("lockEnabled"))?.value === true;
}

export async function getAutoLockMinutes(): Promise<number> {
  return Number((await getSetting("autoLockMinutes")) ?? 1);
}
export async function setAutoLockMinutes(min: number): Promise<void> {
  await setSetting("autoLockMinutes", min);
}

export async function touchActivity(): Promise<void> {
  await setSetting("lastActiveAt", Date.now());
}

export async function shouldShowLockScreen(): Promise<boolean> {
  if (!(await isLockEnabled())) return false;
  const last = Number((await getSetting("lastActiveAt")) ?? 0);
  const minutes = await getAutoLockMinutes();
  if (!last) return true; // fresh boot, never unlocked this session
  return Date.now() - last > minutes * 60_000;
}
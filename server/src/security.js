import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export const newToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const tokenHash = (token) =>
  createHash("sha256").update(token, "utf8").digest("hex");

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt:${salt.toString("hex")}:${Buffer.from(derived).toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored || "").split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = Buffer.from(await scrypt(password, Buffer.from(saltHex, "hex"), expected.length));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function safeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

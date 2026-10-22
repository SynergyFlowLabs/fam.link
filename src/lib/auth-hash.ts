import { scryptSync, randomBytes } from "node:crypto";

/**
 * Synchronous password hashing (async scrypt lives in src/lib/auth.ts for
 * request-path use). Both produce the identical `salt:hash` format, so
 * seeds and signups are interchangeable.
 */
export function hashPasswordSync(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

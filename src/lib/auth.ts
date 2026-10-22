import { cookies } from "next/headers";
import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";

const scrypt = promisify(scryptCb);

const SESSION_COOKIE = "famlink_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

/**
 * Stateless signed sessions.
 *
 * The session cookie carries `{ uid, email, exp }` plus an HMAC-SHA256
 * signature (base64url both). Validation needs NO database row, which is
 * required on serverless hosting: every instance gets its own ephemeral
 * SQLite file, so a DB-stored session only exists on the instance that
 * created it and any other instance would treat the user as signed out.
 *
 * We still confirm the user exists (by uid, falling back to the stable
 * email) so accounts deleted after the cookie was issued are signed out.
 * Set SESSION_SECRET in production — instances must share the secret or
 * cookies minted by one instance fail validation on another.
 */
const SESSION_SECRET =
  process.env.SESSION_SECRET ??
  (process.env.NODE_ENV === "production" && process.env.VERCEL
    ? warnInsecureSecret("SESSION_SECRET")
    : "famlink-insecure-dev-secret");

function warnInsecureSecret(name: string): string {
  console.warn(
    `${name} is not set — falling back to an insecure default. Sessions will not survive instance restarts or work across instances.`,
  );
  return "famlink-insecure-dev-secret";
}

interface SessionPayload {
  uid: string;
  email: string;
  exp: number;
}

function sign(body: string): string {
  return createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
}

export async function createSession(user: {
  id: string;
  email: string;
}): Promise<void> {
  const payload: SessionPayload = {
    uid: user.id,
    email: user.email,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const expiresAt = new Date(payload.exp);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, `${body}.${sign(body)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expected = Buffer.from(sign(body));
  const provided = Buffer.from(signature);
  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    return null;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
  } catch {
    return null;
  }
  if (
    typeof payload.uid !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.exp !== "number" ||
    payload.exp < Date.now()
  ) {
    return null;
  }

  const byId = await db
    .select()
    .from(users)
    .where(eq(users.id, payload.uid))
    .limit(1);
  if (byId[0]) return byId[0];

  // uid may differ across instances (ephemeral DB); email is the stable key.
  const byEmail = await db
    .select()
    .from(users)
    .where(eq(users.email, payload.email))
    .limit(1);
  return byEmail[0] ?? null;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

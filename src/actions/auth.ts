"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/roles";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { persons, trees, users } from "@/db/schema";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";

export type AuthState = { error: string } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signupAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) return { error: "Please tell us your name." };
  if (!EMAIL_RE.test(email)) return { error: "That email doesn't look right." };
  if (password.length < 8)
    return { error: "Passwords need at least 8 characters." };

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0)
    return { error: "An account with this email already exists. Try signing in." };

  const userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    email,
    name,
    passwordHash: await hashPassword(password),
  });

  // Activation: every account starts with a tree and themselves as the root,
  // so the first session is spent building, not setting up.
  const treeId = randomUUID();
  const personId = randomUUID();
  const nameParts = name.split(/\s+/);
  await db.insert(trees).values({
    id: treeId,
    ownerId: userId,
    name: "My family",
    focusPersonId: personId,
  });
  await db.insert(persons).values({
    id: personId,
    treeId,
    firstName: nameParts[0] ?? null,
    lastName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : null,
    living: true,
  });

  await createSession({ id: userId, email });
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function signinAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email or password is incorrect." };
  }

  await createSession({ id: user.id, email: user.email });
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function signoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

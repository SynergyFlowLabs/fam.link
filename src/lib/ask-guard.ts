/**
 * Ask-a-relative links — pure token + rate-limit policy (issue #35).
 * The Knowledge Holder answers one question with no account; the guards
 * below keep that open form spam-resilient without CAPTCHA friction.
 */

import { randomBytes } from "node:crypto";

/** 32 chars of base64url — same token discipline as share_links. */
export const ASK_TOKEN_LENGTH = 32;

/** CSPRNG, URL-safe, unique-by-construction (2^192 space). */
export function generateAskToken(
  bytes: (n: number) => Buffer = randomBytes,
): string {
  return bytes(24).toString("base64url").slice(0, ASK_TOKEN_LENGTH);
}

// ---------- rate limiting ----------

export const ASK_MAX_PER_WINDOW = 10;
export const ASK_WINDOW_MS = 60 * 60 * 1000; // one hour

/**
 * Sliding-window check for one ask link (keyed by token+IP by the caller).
 * Pure: pass the timestamps of recent submissions; returns true when this
 * submission is allowed.
 */
export function allowSubmission(
  recentTimestampsMs: number[],
  nowMs: number,
  max = ASK_MAX_PER_WINDOW,
  windowMs = ASK_WINDOW_MS,
): boolean {
  const inWindow = recentTimestampsMs.filter((t) => nowMs - t < windowMs);
  return inWindow.length < max;
}

/** Which timestamps stay relevant for the next check (prune old ones). */
export function pruneSubmissions(
  recentTimestampsMs: number[],
  nowMs: number,
  windowMs = ASK_WINDOW_MS,
): number[] {
  return recentTimestampsMs.filter((t) => nowMs - t < windowMs);
}

// ---------- link state ----------

export interface AskLinkStateLike {
  expiresAt: Date | number | null;
  revokedAt: Date | number | null;
}

/** A link answers when it exists, isn't revoked, and hasn't expired. */
export function linkIsOpen(
  link: AskLinkStateLike | null | undefined,
  nowMs: number,
): boolean {
  if (!link) return false;
  const expires = link.expiresAt ? new Date(link.expiresAt).getTime() : null;
  const revoked = link.revokedAt ? new Date(link.revokedAt).getTime() : null;
  if (revoked !== null && revoked <= nowMs) return false;
  if (expires !== null && expires <= nowMs) return false;
  return true;
}

export const ASK_DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Question copy rules — warm, specific, short. */
export const ASK_MAX_QUESTION = 200;
export const ASK_MAX_ANSWER = 4000;
export const ASK_MAX_NAME = 60;

export function validateAskQuestion(raw: string): string | null {
  const q = raw.trim();
  if (!q) return "Write the question you want to ask.";
  if (q.length > ASK_MAX_QUESTION)
    return `Keep the question under ${ASK_MAX_QUESTION} characters.`;
  return null;
}

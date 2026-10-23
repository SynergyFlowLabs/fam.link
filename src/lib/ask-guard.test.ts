import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ASK_MAX_PER_WINDOW,
  ASK_WINDOW_MS,
  allowSubmission,
  generateAskToken,
  linkIsOpen,
  pruneSubmissions,
} from "./ask-guard.ts";

describe("ask-guard", () => {
  it("generateAskToken makes URL-safe, unique 32-char tokens", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const t = generateAskToken();
      assert.equal(t.length, 32);
      assert.match(t, /^[A-Za-z0-9_-]+$/); // base64url — safe in URLs
      tokens.add(t);
    }
    assert.equal(tokens.size, 200);
  });

  it("allowSubmission enforces the sliding window", () => {
    const now = 1_000_000_000;
    const fresh: number[] = [];
    for (let i = 0; i < ASK_MAX_PER_WINDOW - 1; i++) fresh.push(now - i * 1000);
    assert.ok(allowSubmission(fresh, now)); // 9 in window → allowed
    // exactly 10 recent → blocked
    const full = [...fresh, now - 500];
    assert.equal(allowSubmission(full, now), false);
    // old submissions age out of the window
    const old = full.map((t) => t - ASK_WINDOW_MS - 10_000);
    assert.ok(allowSubmission(old, now));
    // blocked, then an hour passes → allowed again
    assert.equal(allowSubmission(full, now + ASK_WINDOW_MS + 1), true);
  });

  it("pruneSubmissions drops timestamps outside the window", () => {
    const now = 5_000_000;
    const pruned = pruneSubmissions([now - 1000, now - ASK_WINDOW_MS - 1, now - 2000], now);
    assert.deepEqual(pruned, [now - 1000, now - 2000]);
  });

  it("linkIsOpen honours revocation and expiry", () => {
    const now = 1_000_000;
    assert.ok(linkIsOpen({ expiresAt: null, revokedAt: null }, now));
    assert.ok(linkIsOpen({ expiresAt: now + 1000, revokedAt: null }, now));
    assert.equal(linkIsOpen({ expiresAt: now - 1, revokedAt: null }, now), false);
    assert.equal(linkIsOpen({ expiresAt: null, revokedAt: now - 1 }, now), false);
    assert.equal(linkIsOpen(null, now), false);
  });
});

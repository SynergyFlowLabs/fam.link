# ADR 0004 — Notifications are derived from state, never stored as their own feed

**Status:** accepted · **Date:** 2026-10 · **Deciders:** product and engineering

## Context

A family space has four things that should reach a person without them going looking: a proposal
waiting for their decision, a claim on a profile they manage, a relative opening an invitation, and
duplicate profiles that need review. The obvious implementation is a `notifications` table written
by each of those actions.

That design has two failure modes we have already designed around elsewhere:

1. **Divergence.** A stored notification can outlive the state that caused it. If a proposal is
   decided, a claim is reversed, or a person separates, a table copy keeps asserting something that
   is no longer true.
2. **Privacy leakage.** Notifications name people. A stored row written when someone was visible can
   still be delivered after a hidden branch or a visibility change. That is a second privacy
   implementation, and it will drift from the first.

## Decision

Derive the feed at read time from the state that already exists, using the same visibility
projection as every other read. `apps/api/src/notifications.ts` is the only writer, and it writes
nothing.

Unread state is a single timestamp per membership (`notificationSeenAt`), updated when the person
opens the bell. There is no per-item read flag, because the feed is a **status**, not a mailbox.

## Consequences

- There is exactly one privacy implementation; a notification cannot name a person the recipient
  could not otherwise open.
- No background jobs, no delivery fan-out, no retries, no stale rows to clean up. Recounting is a
  pure function, so it is cheap to test.
- Unread counts are approximate by design: opening the bell clears the count, even if one item was
  never clicked. This is the right trade for a family product; precision here is not worth a schema.
- Delivery (email, WhatsApp, push) is *not* solved by this ADR. When real delivery arrives it needs a
  durable outbox with idempotency keys, and this feed becomes the source for its payloads.
- Anything that genuinely needs history ("you changed this field in March") belongs in the activity
  log, which is append-only and already authoritative.

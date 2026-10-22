# ADR 0004 — Notifications are derived from state, not stored

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Engineering

## Context

The MVP needs to tell people that a proposed correction needs them, that their invitation was
accepted, that a relative claimed their profile, and that duplicates need review. The obvious
implementation is a `notifications` table written by each action.

That design has two failure modes that matter more here than in most products:

1. **Drift.** A stored notification can outlive the thing it referred to: a proposal that was
   resolved, a person who then requested separation, a claim that was reversed. The feed would then
   tell someone about state that is no longer true.
2. **Privacy leakage.** A notification is a copy of information. If it is written once and read
   later, it can be read by someone who is no longer permitted to see the person it describes —
   including after a hidden branch is created.

## Decision

**Derive notifications on read** from the state that already exists: live proposals, decisions,
invitation status, claims, memberships, and duplicate candidates. Store only `notificationSeenAt`
per membership, for the unread count.

Consequences that follow from this:

- A notification is produced only if the recipient currently satisfies the same authorisation and
  visibility checks used elsewhere. There is no second privacy implementation.
- Derived notifications must have **stable identity and stable time**. The unread count depends on
  comparing `createdAt` to `seenAt`; a notification stamped `now` on every read can never be marked
  as read. Duplicate suggestions therefore carry the timestamp of the most recently updated
  candidate.
- The feed is bounded (30 items) and sorted by time; it is a "what needs you" list, not a history.
  History is the activity log, which is append-only and is the record of truth.

## Consequences

**Positive**

- No notification backlog to migrate, backfill, or clean up.
- Privacy is automatically correct when visibility or hidden branches change.
- No delivery infrastructure is required to test the behaviour.

**Negative**

- Reading the feed costs a few queries and duplicate scoring; acceptable at MVP scale, and cacheable.
- There is no delivery channel (email, push) and no per-category preference yet. When delivery is
  added, it needs a real outbox — the derivation stays, but sending must be idempotent.
- Some notification kinds cannot exist yet because they would require stored state (for example
  "your relative added a memory three days ago" outlives the event). Those wait for Phase 2.

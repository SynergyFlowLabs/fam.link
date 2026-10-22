# ADR 0002 — Stack and persistence

- **Status:** Accepted (demo-scoped; revisit before production)
- **Date:** 2026-10-22
- **Deciders:** Engineering

## Context

The MVP must answer one question: *will multiple relatives collaborate on one family tree?*
That requires a running, inspectable product quickly — not a production data platform. At the
same time, the domain logic (graph derivation, authority, privacy) is the durable asset and must
not be entangled with framework or storage choices.

## Decision

**Monorepo, TypeScript throughout, npm workspaces.**

```
apps/api        Node HTTP API (Express), JSON-document store
apps/web        React 19 + Vite + CSS tokens
packages/domain Pure TypeScript: persons, edges, derivation, calculator, privacy, authority
```

**The domain package is pure.** No I/O, no framework imports, no ambient state. Functions take
an explicit graph snapshot and return values. This is the seam that every domain test runs at.

**Persistence is a JSON document store behind a `Repository` interface.** The API owns a single
store file (`apps/api/data/store.json`), loaded into memory and written atomically. All access
goes through repository methods; nothing outside the repository touches the file.

The interface is deliberately shaped like a relational schema (persons, edges, memberships,
invites, proposals, activity, visibility) so that replacing the store with Postgres is a
repository implementation, not a domain rewrite.

**Auth is simulated.** A session is real (signed cookie, resolved to a user server-side), but
sign-in is a demo persona switcher rather than OTP/email delivery. This is a testing affordance
for the collaboration and privacy behaviours; it is not shippable auth.

## Consequences

**Positive**

- One command boots the whole product; no external services, no native builds.
- Domain tests are fast and storage-agnostic.
- Swapping storage later is a contained change.

**Negative**

- The JSON store does not support concurrent writers; the API must serialise writes and the
  demo must not be treated as multi-tenant-safe.
- No real email/OTP means the invitation and claim flows are exercised in-app rather than by
  actual message delivery.

## Guardrails

- `packages/domain` must never import from `apps/*`.
- Only `apps/api/src/repository/**` may touch the filesystem.
- The store file is seeded from `apps/api/src/seed.ts` and is safe to delete and regenerate.

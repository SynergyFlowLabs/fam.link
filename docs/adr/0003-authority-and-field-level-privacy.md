# ADR 0003 — Authority and field-level privacy are enforced server-side

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Product, Engineering, Trust & Safety

## Context

The hardest problem in this product is not visualisation. It is deciding who may create, edit,
approve, merge, hide, or delete information about another person — and ensuring that a family's
sensitive information never appears where it should not.

Two failure modes are unacceptable:

1. A protected field is changed without the owner's consent.
2. A hidden person is inferred from a count, a search suggestion, a relationship path, or an
   activity log entry.

Both are trivially possible if authorisation lives in React components or if responses are
filtered only for display.

## Decision

**One authorisation module in the domain, used by every API route.** Roles, precedence, and
protected fields are defined in `packages/domain/authority.ts`. Routes call it; routes never
re-implement it.

**Precedence ladder (exact):**

```
profile owner (about self) > custodian (about a dependent)
  > family administrator (structure and disputes) > contributor > viewer
```

An administrator resolves *disputes*; an administrator may not publish a living owner's
private field against that owner's will. Custody does not survive a successful claim: claiming
transfers control of protected fields to the person and notifies the previous custodian.

**Privacy is applied as a projection at the boundary.** Every API response passes through
`projectPersonForViewer`, which removes fields the viewer is not permitted to see based on
field-level visibility scopes and hidden-branch rules. Enforcement happens **before
serialisation**; the client never receives a field it may not render.

**Derived views must respect the same rules.** Search results, tree counts, relationship paths,
notifications, activity logs, and duplicate suggestions all run through the same visibility
predicate. A path that would traverse a hidden person returns "no visible connection" — not an
error, and not a partial answer that reveals the hidden hop.

**Change management.** Protected-field changes are refused unless:
- the actor is the owner, or
- the actor is an authorised approver acting on an accepted proposal.

Every accepted change writes an immutable activity record containing previous value, new value,
actor, timestamp, and reason/evidence.

## Consequences

**Positive**

- A single place to reason about and test authority.
- Privacy bugs become testable: an API test can assert the *absence* of a field.
- The audit trail is a by-product of the write path rather than a later feature.

**Negative**

- Projection adds work to every response; mitigated by doing it once per request, not per field
  access in the UI.
- Field-level rules are verbose to configure; mitigated by sensible defaults per living/deceased
  and minor status.

## Guardrails

- API tests assert that a restricted field is **absent** from the JSON body, not falsy.
- A property test asserts that any person excluded by a hidden branch is absent from every
  response collection for the blocking viewer.
- The client re-filters defensively, but a client-side change must never be the only defence.

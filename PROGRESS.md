# Implementation Progress — Fam Link MVP

> Living execution log for [`docs/MVP-FEATURES.md`](./docs/MVP-FEATURES.md).
> Updated and pushed after **every** step. Newest step at the bottom of §2.

| Field | Value |
|---|---|
| **Branch** | `arena/28ae815d-fam-link` |
| **Plan source** | [`docs/PRD.md`](./docs/PRD.md), [`docs/MVP-FEATURES.md`](./docs/MVP-FEATURES.md) |
| **Started** | 2026-10-22 |
| **Status** | 🟢 In progress |

---

## 1. How this file is maintained

Each step is a self-contained increment that leaves the repo **typechecking, tested, and runnable**. After completing a step:

1. Update §2 (mark step done, record what shipped and what changed vs. plan).
2. Update §3 (feature checklist) for any MVP criteria proven.
3. Commit and push to `arena/28ae815d-fam-link`.
4. Record any deviation in §5 (decision/scope log) rather than silently diverging.

**Status legend:** ⬜ not started · 🟨 in progress · ✅ done · ⏸️ deferred

---

## 2. Step log

### Step 0 — Plan, conventions, and decision records ✅

**Goal:** make the repository agent-ready and turn the PRD into binding engineering constraints before any code.

**Shipped**
- `PROGRESS.md` (this file) — the execution log.
- `AGENTS.md` — build/test/dev commands, repo layout, code conventions, and non-negotiable domain rules for coding agents.
- `GLOSSARY.md` — canonical domain vocabulary (Person, Claim, Custodian, Family Space, Derived Relationship, …) so code, tests, and docs share one language.
- `docs/adr/0001-family-graph-not-tree.md` — graph model, derived relationships, cycle-safe traversal.
- `docs/adr/0002-stack-and-persistence.md` — TypeScript monorepo, React + Vite, Node API, JSON-document store behind a repository interface.
- `docs/adr/0003-authority-and-field-level-privacy.md` — server-side, field-level enforcement and the authority precedence ladder.

**Verification:** documents reviewed against PRD §7, §8, §9 for contradiction.

---

<!-- NEXT STEPS APPENDED BELOW -->

---

## 3. MVP feature checklist

Derived from [`docs/MVP-FEATURES.md`](./docs/MVP-FEATURES.md) §4. A box is checked only when the acceptance criteria are demonstrably met in the running app or a passing test.

### E1 — Account and identity
- [ ] F-1.1 Authentication (email magic link / phone OTP / social) — `MUST`
- [ ] F-1.2 Personal profile + partial dates — `MUST`
- [ ] F-1.3 Alternative names — `SHOULD`
- [ ] F-1.4 Account deletion and export — `MUST`

### E2 — Family space and tree creation
- [ ] F-2.1 Create a family space — `MUST`
- [ ] F-2.2 Add parents, spouses, children, siblings — `MUST`
- [ ] F-2.3 Relationship types (stored vs derived) — `MUST`
- [ ] F-2.4 Edit and correct any person — `MUST`
- [ ] F-2.5 Partial dates, places, uncertain facts — `MUST`
- [ ] F-2.6 Guided onboarding — `MUST`
- [ ] F-2.7 Places lived — `COULD`
- [ ] F-2.8 Biography — `SHOULD`
- [ ] F-2.9 Profile photo — `MUST`

### E3 — Interactive visualisation
- [ ] F-3.1 Focus-centred tree rendering — `MUST`
- [ ] F-3.2 Zoom, pan, layout — `MUST`
- [ ] F-3.3 Expand and collapse branches — `MUST`
- [ ] F-3.4 Generation navigation — `MUST`
- [ ] F-3.5 Compact vs detailed view — `SHOULD`
- [ ] F-3.6 Accessible list fallback — `MUST`
- [ ] F-3.7 Search within the tree — `SHOULD`

### E4 — Invitations and claiming
- [ ] F-4.1 Shareable invite link — `MUST`
- [ ] F-4.2 Email invitation — `MUST`
- [ ] F-4.3 WhatsApp-friendly invitation — `MUST`
- [ ] F-4.4 Claim an existing profile — `MUST`
- [ ] F-4.5 Assign expected relationship at invite time — `MUST`
- [ ] F-4.6 Invitation management + rate limits — `MUST`

### E5 — Collaborative editing and governance
- [ ] F-5.1 Roles and precedence — `MUST`
- [ ] F-5.2 Propose an edit — `MUST`
- [ ] F-5.3 Direct edit within authority — `MUST`
- [ ] F-5.4 Activity log — `MUST`
- [ ] F-5.5 Disputed values — `SHOULD`
- [ ] F-5.6 Revert — `SHOULD`
- [ ] F-5.7 Comments on proposals — `COULD`

### E6 — Privacy and visibility
- [ ] F-6.1 Private by default — `MUST`
- [ ] F-6.2 Field-level visibility — `MUST`
- [ ] F-6.3 Hidden branches and blocked users — `MUST`
- [ ] F-6.4 Separation and removal requests — `MUST`
- [ ] F-6.5 Minors — `MUST`
- [ ] F-6.6 Photo permissions — `SHOULD`

### E7 — Relationship calculator
- [ ] F-7.1 Relationship between any two people — `MUST`
- [ ] F-7.2 Path and common ancestor — `MUST`
- [ ] F-7.3 Plain-language explanation — `MUST`
- [ ] F-7.4 "How am I related to…" shortcut — `MUST`
- [ ] F-7.5 Shareable result — `SHOULD`
- [ ] F-7.6 Locale-aware kinship terminology — `SHOULD`

### E8 — Search and duplicate prevention
- [ ] F-8.1 Search people before adding — `MUST`
- [ ] F-8.2 Duplicate detection — `MUST`
- [ ] F-8.3 Merge — `MUST`
- [ ] F-8.4 People directory — `SHOULD`

### E9 — Platform essentials
- [ ] F-9.1 Audit logging — `MUST`
- [ ] F-9.2 Internationalisation and RTL — `MUST`
- [ ] F-9.3 Notifications — `MUST`
- [ ] F-9.4 Data export — `MUST`
- [ ] F-9.5 Tree health summary — `COULD`
- [ ] F-9.6 Abuse controls — `MUST`

---

## 4. Release slice plan

From [`docs/MVP-FEATURES.md`](./docs/MVP-FEATURES.md) §8, mapped to implementation steps.

| Slice | Contents | Status |
|---|---|---|
| S1 — Domain skeleton | Graph model, derivation, relationship calculator, tests | ⬜ |
| S2 — Persistence + API | Repository, seed family, auth-lite, REST endpoints | ⬜ |
| S3 — See it | Tree focus view, zoom/pan, expand/collapse, list fallback | ⬜ |
| S4 — Invite it | Invitations, claim flow, onboarding | ⬜ |
| S5 — Share it | Roles, proposals, activity log, disputes | ⬜ |
| S6 — Trust it | Field-level privacy, hidden branches, separation, minors | ⬜ |
| S7 — Harden | Search, duplicates, export, i18n, a11y, tree health | ⬜ |

---

## 5. Decision and deviation log

| # | Date | Decision / deviation | Why |
|---|---|---|---|
| 1 | 2026-10-22 | Implementation targets the **domain, API, and web app** as a single monorepo; `packages/ui` is folded into `apps/web` until there is a second consumer. | Avoid premature package boundaries; the README's proposed `packages/ui` had no second consumer. |
| 2 | 2026-10-22 | Persistence is a JSON-document store behind a repository interface, not Postgres/SQLite. | Keeps the demo self-contained and bootable in one command; the interface is the seam that a real database replaces. |
| 3 | 2026-10-22 | Auth is a **demo identity switcher** (simulated personas) rather than real OTP/email delivery. | The MVP question is about collaboration and privacy, not mail infrastructure; the session abstraction is real, the delivery is simulated. |
| 4 | 2026-10-22 | English + Urdu locale scaffolding; full kinship term tables ship progressively (D-5 in the MVP doc). | Model and RTL support now, curation later. |

---

## 6. Verification log

| Step | Typecheck | Unit tests | Build | Notes |
|---|---|---|---|---|
| 0 | n/a | n/a | n/a | Docs only |

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

### Step 1 — Domain: family graph, relationships, privacy, authority ✅

**Goal:** nail the durable logic first. Everything else is a view over this package.

**Shipped** (`packages/domain`, pure TypeScript, zero I/O)
- `types.ts` — `Person`, `Relationship`, `FamilySpace`, `Membership`, `Proposal`, `ActivityEntry`, `Invitation`, roles, visibility scopes, protected fields. Partial dates as a first-class `FamilyDate`.
- `dates.ts` — exact/month/year/approximate/unknown dates, ages, life spans, minors. Refuses impossible input instead of guessing.
- `graph.ts` — indexed graph, cycle-safe ancestor/descendant walks, sibling derivation, unions (a partnership + its children), bounded shortest path.
- `relationships.ts` — the relationship calculator: path enumeration, basis ranking (blood > adoptive > foster > guardian > step > marriage), sibling/half-sibling/aunt/cousin/removal terms, in-law and step classification, path-aware explanations ("your father's brother's daughter"), equal-distance alternatives, and Urdu kinship terms (paternal/maternal, elder/younger).
- `privacy.ts` — field-level projection, viewer context, hidden-person gates, separated and blocked people, contact-field lock, `visibilityGate` for traversals.
- `authority.ts` — precedence ladder, protected-field decisions (`direct` vs `proposal`), proposal and merge authority, separation requests.
- `duplicates.ts` — weighted, explainable duplicate scoring with relationship overlap dominant; preventive draft detection; field-by-field merge plans.
- `search.ts` — visibility-aware search over alternative names, transliterations, and phonetic keys.
- `fixtures.ts` — three synthetic families: the Khan family (PRD worked example), a tangled family (half-siblings, adoption, cousin marriage), and a cyclic family.

**Verification:** `npm test` → **59 passing**; `npm run typecheck` → clean.

**Deviations:** `fullSiblingIds` renamed `siblingIds` because it returns everyone sharing a parent, including half-siblings — the old name would have caused a real bug. Sibling-level authority and privacy are therefore decided by `sharedParentIds` counts, not by the helper name.

---

### Step 2 — API, persistence, and seed family ✅

**Goal:** every domain rule enforced at the HTTP boundary, with a demo family rich enough to test collaboration.

**Shipped** (`apps/api`)
- `db.ts` — JSON-document store behind a repository interface, atomic writes, in-memory override for tests, hidden-branch and dismissed-duplicate records.
- `seed.ts` — a 20-person, four-generation synthetic Khan family including a second marriage, a half-sibling, an adopted child (with biological parents unrecorded), deceased grandparents, three minors, and a disputed birth date.
- `app.ts` — sessions (demo persona switcher, httpOnly cookie), spaces, focus-window tree, people search/directory, profile with relationship + permissions, create/patch person, relationships, invitation preview/accept/decline/revoke, proposals, duplicate review/merge/dismiss, activity, export.
- Privacy and authority are applied by the domain modules on every response; routes never filter fields themselves.

**Verification:** `npm test` → **75 passing** (59 domain + 16 API); `npm run typecheck` clean.

**Deviations and fixes found by the API layer**
1. **Relationship ranking bug (real, not test-only).** A three-step adoptive path ("your daughter's sister") was beating a four-step blood cousin because only shortest paths were enumerated. Replaced with a tiered search plus a `pathScore = length + basis penalty`, so a two-step adopted sibling beats a six-step blood cousin while a blood cousin still beats an adoptive one at equal distance. Direct partnerships are checked first: your wife is your wife, even though she is also your children's mother.
2. **Co-parent paths** (`child → parent`) are now classified as partnerships rather than falling through to "relative".
3. **Proposal `previousValue` leaks.** A proposal on a protected field returned the old value to a member who could not see that field. Responses now strip it unless the actor may view the field.
4. **Seed claims.** One claimed person per demo account; several people initially shared a claim, which made "who am I in this tree?" ambiguous.

---

### Step 3 — Web client: tree, people, calculator, invitations, activity ✅

**Goal:** make the collaboration and privacy model visible, and make the calculator the thing you show someone.

**Shipped** (`apps/web`)
- `styles/tokens.css` + `styles/app.css` — an ink-on-paper design system (serif names, verdigris and lacquer accents, dotted archival ground), responsive to 390px, visible focus, reduced-motion support.
- `tree/layout.ts` (+ tests) — pure generation assignment and deterministic layout, cycle-safe, partner grouping, barycentric row ordering.
- `views/TreeView.tsx` — focus-window chart with pan, wheel zoom, reset, generation depth controls, partner/parent connectors, in-canvas toolbar, and an **accessible outline fallback**.
- `views/TreeView.tsx` → `ProfilePanel` — relationship sentence + Urdu term, close family, field-level "hidden from you" disclosure, inline editing routed through authority (applied vs. sent for approval), proposal decisions, history, separation request.
- `views/PeopleView.tsx` — visibility-scoped search, living/remembered directory, duplicate review with explainable signals, merge and dismiss.
- `views/CalculatorView.tsx` — two-person picker, sentence result, basis and path, scrubbed copy-to-share.
- `views/InvitationsView.tsx` — invite creation against an existing unclaimed profile, WhatsApp share, revoke, status list.
- `views/InviteView.tsx` — public invitation page carrying the relationship, and a claim flow ("this is not me" included).
- `views/ActivityView.tsx`, `components/ui.tsx`, `hooks.ts`, `api.ts` (relative URLs only; `/api` proxied).
- `App.tsx` — shell, hash router, persona switcher, add-relative dialog with duplicate warning before creation.

**Verification:** `npm test` → **81 passing** (59 domain + 16 API + 6 layout); `npm run typecheck` clean; `npm run build -w @famlink/web` succeeds; live dev servers exercised with curl (session → tree → relationship returns "first cousin · چچا زاد").

**Deviations**
1. `packages/ui` from the README's proposed layout is not created: there is still only one consumer. Components live in `apps/web/src/components`.
2. The add-relative dialog posts relationship anchors (`parentId` / `partnerId` / `childId` / `siblingOfId`) and the API creates the edges; siblings are created by sharing parents, never by storing a sibling edge.
3. Demo identity switching is prominent in the UI and labelled as a demo affordance, so it cannot be mistaken for real authentication.

---

### Step 4 — Guided onboarding and family-space creation ✅

**Goal:** remove the empty canvas. A new family starts from a person, not a diagram.

**Shipped**
- `POST /api/spaces` now seeds the creator's own person record and claims it, so the tree starts from a real identity and the creator immediately owns their own sensitive fields.
- `views/Onboarding.tsx` — six skippable steps (you → parents → siblings → partner → children → invite), each creating real relationships: parents as `childId`, siblings through **shared parents** (never a stored sibling edge), partners as `partnerId`, children as `parentId`. Ends with a generated invitation.
- `NewSpaceDialog` in the shell, plus a topbar "New family" action.

**Verification:** exercised end-to-end against a throwaway store with curl — created a space, renamed self, added a parent, added a sibling, then read the tree: **3 nodes, 2 edges**, and the sibling correctly reached the tree through the parent rather than a sibling link. Invitation creation returned a token. Full suite still **81 passing**, typecheck clean.

**Note on scope:** this is deliberately not a multi-space switcher; the shell picks the user's first space, and the new space becomes active for the onboarding session. Building a real space switcher belongs with invitations across spaces (phase 2 in the PRD).

---

<!-- NEXT STEPS APPENDED BELOW -->

---

## 3. MVP feature checklist

Derived from [`docs/MVP-FEATURES.md`](./docs/MVP-FEATURES.md) §4. A box is checked only when the acceptance criteria are demonstrably met in the running app or a passing test.

### E1 — Account and identity
- [ ] F-1.1 Authentication — `MUST` *(demo persona sessions only; real OTP/email delivery pending)*
- [ ] F-1.2 Personal profile + partial dates — `MUST`
- [ ] F-1.3 Alternative names — `SHOULD`
- [ ] F-1.4 Account deletion and export — `MUST`

### E2 — Family space and tree creation
- [x] F-2.1 Create a family space — `MUST`
- [x] F-2.2 Add parents, spouses, children, siblings — `MUST` *(API)*
- [x] F-2.3 Relationship types (stored vs derived) — `MUST`
- [x] F-2.4 Edit and correct any person — `MUST` *(API; history via activity log)*
- [ ] F-2.5 Partial dates, places, uncertain facts — `MUST`
- [x] F-2.6 Guided onboarding — `MUST`
- [ ] F-2.7 Places lived — `COULD`
- [ ] F-2.8 Biography — `SHOULD`
- [ ] F-2.9 Profile photo — `MUST`

### E3 — Interactive visualisation
- [x] F-3.1 Focus-centred tree rendering — `MUST`
- [x] F-3.2 Zoom, pan, layout — `MUST`
- [x] F-3.3 Expand and collapse branches — `MUST` *(depth controls; per-node collapse pending)*
- [x] F-3.4 Generation navigation — `MUST` *(focus + depth controls; keyboard tree navigation pending)*
- [ ] F-3.5 Compact vs detailed view — `SHOULD`
- [x] F-3.6 Accessible list fallback — `MUST`
- [ ] F-3.7 Search within the tree — `SHOULD`

### E4 — Invitations and claiming
- [x] F-4.1 Shareable invite link — `MUST`
- [ ] F-4.2 Email invitation — `MUST` *(not sent; copy + link generation only)*
- [x] F-4.3 WhatsApp-friendly invitation — `MUST` *(share link generation; no delivery)*
- [x] F-4.4 Claim an existing profile — `MUST` *(API)*
- [x] F-4.5 Assign expected relationship at invite time — `MUST` *(API)*
- [x] F-4.6 Invitation management + rate limits — `MUST` *(API)*

### E5 — Collaborative editing and governance
- [x] F-5.1 Roles and precedence — `MUST` *(domain; API enforcement pending)*
- [x] F-5.2 Propose an edit — `MUST` *(API)*
- [x] F-5.3 Direct edit within authority — `MUST` *(API)*
- [x] F-5.4 Activity log — `MUST` *(API)*
- [ ] F-5.5 Disputed values — `SHOULD` *(proposals exist; retained conflicting values pending)*
- [ ] F-5.6 Revert — `SHOULD`
- [ ] F-5.7 Comments on proposals — `COULD`

### E6 — Privacy and visibility
- [x] F-6.1 Private by default — `MUST`
- [x] F-6.2 Field-level visibility — `MUST` *(domain projection + tests)*
- [x] F-6.3 Hidden branches and blocked users — `MUST` *(domain gates + tests)*
- [x] F-6.4 Separation and removal requests — `MUST` *(API)*
- [x] F-6.5 Minors — `MUST` *(projection + tests)*
- [ ] F-6.6 Photo permissions — `SHOULD`

### E7 — Relationship calculator
- [x] F-7.1 Relationship between any two people — `MUST` *(domain only; UI pending)*
- [x] F-7.2 Path and common ancestor — `MUST` *(domain only; UI pending)*
- [x] F-7.3 Plain-language explanation — `MUST` *(domain only; UI pending)*
- [x] F-7.4 "How am I related to…" shortcut — `MUST`
- [x] F-7.5 Shareable result — `SHOULD` *(scrubbed copy text; no expiring share link yet)*
- [x] F-7.6 Locale-aware kinship terminology — `SHOULD` *(Urdu terms; full locale set pending)*

### E8 — Search and duplicate prevention
- [x] F-8.1 Search people before adding — `MUST` *(domain only; UI pending)*
- [x] F-8.2 Duplicate detection — `MUST` *(domain only; review queue UI pending)*
- [x] F-8.3 Merge — `MUST` *(merge plan, API, and review UI; revert log pending)*
- [x] F-8.4 People directory — `SHOULD` *(API)*

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
| S1 — Domain skeleton | Graph model, derivation, relationship calculator, tests | ✅ |
| S2 — Persistence + API | Repository, seed family, auth-lite, REST endpoints | ✅ |
| S3 — See it | Tree focus view, zoom/pan, expand/collapse, list fallback | ✅ |
| S4 — Invite it | Invitations, claim flow, onboarding | ✅ |
| S5 — Share it | Roles, proposals, activity log, disputes | 🟨 disputes UI pending |
| S6 — Trust it | Field-level privacy, hidden branches, separation, minors | 🟨 hidden-branch authoring UI pending |
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
| 1 | ✅ clean | ✅ 59 passing | n/a | Domain package, no I/O |
| 2 | ✅ clean | ✅ 75 passing | n/a | API + seed; no web client yet |
| 3 | ✅ clean | ✅ 81 passing | ✅ web build 268 kB (82 kB gzip) | Dev servers exercised over HTTP |
| 4 | ✅ clean | ✅ 81 passing | ✅ | Onboarding flow exercised end-to-end on a throwaway store |

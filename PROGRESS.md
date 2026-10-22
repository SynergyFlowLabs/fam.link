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

### Step 5 — Disputes, revert, notifications, abuse reports ✅

**Goal:** make disagreement safe. This is the difference between a family tool and a form.

**Shipped**
- `packages/domain/src/proposals.ts` — conflict detection on live proposals, grouping by field, dispute descriptions, decision plans that supersede rival claims, and revert plans derived from the activity log. Value comparison is structural (`JSON.stringify`), so partial dates compare by content rather than identity.
- API: conflicting proposals now mark **both** sides `disputed`, retain both values, and log the dispute. Accepting one supersedes the others. Every applied field writes its own activity entry with `field`, `before`, and `after`, which makes **precise revert** possible: `POST /activity/:id/revert` restores the prior value and records the revert as a new change rather than erasing history.
- `notifications.ts` — notifications are **derived from state**, not stored, so they cannot drift from the tree and a recipient can never be told about a person they cannot see. Categories: proposals awaiting your decision, decisions on your proposals, invitation opens/accepts, claims, separations, new members, duplicate candidates. Unread is tracked per membership.
- New routes: `/notifications`, `/notifications/seen`, `/disputes`, `/activity/:id/revert`, `/reports`.
- UI: notification bell with unread count and navigation; a disputes section inside Activity with per-claim accept/reject; revert buttons on history entries; "Report a problem" on every profile.

**Verification:** **100 tests passing** (69 domain + 31 API), typecheck clean, web build clean. Exercised live on a throwaway store: two contributors proposed different birth years, both proposals came back `disputed`, three claims were retained for the same field, and the administrator's feed showed 5 unread notices.

**Deviations**
1. Notifications are **derived on read**, so there is no delivery channel and no per-category preference yet (F-9.3 is partially met).
2. The duplicate-suggestion notice initially used "now" as its timestamp, which made the unread count impossible to clear. It now derives its timestamp from the most recently updated candidate — a small bug with a real lesson: derived notifications need stable identity *and* stable time.

---

### Step 6 — Privacy controls, tree readability, account deletion ✅

**Goal:** privacy is a product surface, not a settings dump, and the chart stays readable as families grow.

**Shipped**
- Domain: `canChangeVisibility` (owner or custodian only — an administrator may not widen or narrow a living person's fields), `VISIBILITY_SCOPES` with honest labels, `CONFIGURABLE_FIELDS`, and `isVisibilityScope` validation. Tested.
- API:
  - `PATCH /people/:id/visibility` — separate route so authority is explicit; rejects unknown scopes and refuses `public` for any living person.
  - `GET/POST/DELETE /hidden-branches` — a member can hide a subtree **from their own view only**; nothing is deleted, and the hidden branch is invisible in the tree, search, counts, and relationship answers (returns the same 404 as a person who was never recorded).
  - `DELETE /account` — removes the account and contact details, unclaims profiles, and reports exactly what is retained and why.
- UI: a Privacy screen with per-field audience selectors, hidden-branch management, scoped export download, and account deletion; a notification bell was already added in Step 5.
- Tree: compact/detailed toggle and in-branch search that dims non-matching people instead of hiding them, so the shape of the family stays visible.

**Verification:** **113 tests passing** (75 domain + 38 API), typecheck clean, web build clean. The hidden-branch test asserts the important property: the same 404 for a hidden person as for a person who never existed.

**Deviation:** the visibility selector shows a *default* value derived from `hiddenFields` rather than the stored override, because the API does not return another person's `fieldVisibility` map. Reading your own configuration back is a small API addition for the next pass; the current behaviour never misrepresents what others can see, only which scope you previously chose.

---

### Step 7 — Prove the loop, and build for RTL from the start ✅

**Goal:** test the product's reason to exist, not just its parts; and stop treating RTL as a later concern.

**Shipped**
- `apps/api/src/loop.test.ts` — the central loop as a single API-level test: invitation → claim an existing profile (no duplicate person created) → owner corrects a protected field directly → a second relative's competing claim becomes a proposal → the owner rejects it → both values remain on record → the activity log contains claim, update, and rejection.
- **One human, one profile:** accepting an invitation when you already own a profile in that space now returns 409 with an explanation. This was discovered by writing the loop test, which had accidentally made one account own two people. Duplicate claims are a real integrity failure in a family graph, not an edge case.
- Accepting an invitation now works for the signed-in user, not only via an explicit demo persona in the request body.
- `apps/web/src/i18n.tsx` — locale provider with English and Urdu dictionaries, `dir="rtl"` on the document, persisted preference, and a language selector in the top bar. Navigation, shell copy, and tree controls are translated; chart geometry stays LTR because coordinates are not text.
- Demo dataset gained two unclaimed accounts so claiming can be exercised without overloading an existing persona.

**Verification:** **115 tests passing** (75 domain + 40 API), typecheck clean, web build clean.

**Deviation (honest):** F-9.2 is **partially** met. The shell, navigation, and tree controls are externalised and RTL-correct; screen bodies, dialogs, and email/invite copy are still English-only. Marked partial in §3 below rather than ticked.

---

### Step 8 — Documentation, ADR for derived notifications ✅

**Shipped**
- `docs/adr/0004-derived-notifications.md` — why notifications are computed rather than stored, including the two failure modes it prevents (drift, and privacy leakage after visibility changes) and the requirement for stable identity *and* stable time.
- README rewritten to reflect the working demo: run instructions, demo accounts, what exists, what is deliberately missing, and the constraints carried into the code.

**Verification:** `npm test` → **115 passing**; `npm run typecheck` clean; production build clean.

---

### Step 9 — Visibility readback and a localisation guard ✅

**Shipped**
- `projectPerson` now returns the **effective** scope of every configurable field (`visibility`) plus
  `canEditVisibility`, but only to the owner or the custodian of an unclaimed profile. Other
  relatives still receive `hiddenFields` and nothing else, so configuration is not leaked as a side
  effect of the projection.
- Privacy screen uses those values as the real state of its selectors instead of inferring a scope
  from whether a field happened to be hidden, and reloads after each change so the control cannot
  drift from the server. F-6.2 closed.
- `apps/web/src/i18n.test.ts` — dictionary parity (en ↔ ur), no empty Urdu strings, no English
  copied through, no raw keys rendered as copy. Localisation drift is now a test failure.

**Verification:** **120 tests passing** (75 domain + 41 API + 4 i18n), typecheck clean, web build
296 kB (89 kB gzip). Confirmed against the running API that Bilal reads back
`birthDate: immediate-family` while Sadia receives no `visibility` object.

---

### Step 10 — Undo for the only destructive operation ✅

**Goal:** merging is the one action that hides a record and rewrites edges. Until now it was one-way,
so a mistaken merge meant rebuilding a person by hand.

**Shipped**
- `store.merges` — a merge log holding the survivor's previous field values, a full snapshot of the
  absorbed record, and the ids of every relationship the merge re-pointed.
- `POST /duplicates/merges/:id/revert` (administrators only). Reversal restores both records and
  re-points the moved edges, but **skips any field edited after the merge** and says so, rather than
  silently discarding later work. It also refuses to create an edge that already exists, and a
  second undo returns 409.
- `GET /duplicates/merges` — merge history with who did it and whether it was undone.
- People screen: merge history with an **Undo merge** action; the confirmation after merging now
  says the record is recoverable because that is true.
- `loadStore` normalises an older `store.json` instead of crashing on a collection added since.
- `apps/api/src/merge-revert.test.ts` — clean undo (edges restored, no duplicate edges, second undo
  rejected), undo after a later edit (field preserved, `skipped` reported), and contributor refusal.

**Verification:** **123 tests passing** (75 domain + 44 API + 4 i18n), typecheck clean, web build
297 kB (89 kB gzip). F-8.3 closed.

---

### Step 11 — Tree health, and a duplicate queue that is worth opening ✅

**Shipped**
- `packages/domain/src/health.ts` — `treeHealth()` reports checkable problems rather than a vague
  completeness score: impossible date ranges (death before birth), a parent under 12 at a child's
  birth, living people over 110, records with no links, remembered people without a death date,
  open disputes, and possible duplicates. Every finding names people by id and carries a severity,
  so "no birth date yet" (info) is never presented as equivalent to "born before your mother"
  (blocking).
- `GET /spaces/:id/health` filters findings through the viewer's visibility gate, so the list cannot
  be used to infer that a hidden person exists. Dispute and duplicate inputs come from the same
  checks used elsewhere, not a second implementation.
- People screen: a **Tree health** card listing findings with names, plus a note of how many people
  are connected.
- Duplicate detection was producing twelve candidates in a thirteen-person demo family, which made
  the review queue useless. The rules are now: a record entered twice always shares a *name*
  (similarity ≥ 0.55), two people already directly related are not duplicates, and known birth years
  more than two apart rule a match out. The demo family gained one deliberately planted duplicate so
  the queue has one honest example instead of noise.
- Relationship ranking was reporting "your daughter's father's brother's son" for a woman's nephew.
  Paths are now scored as length plus a basis penalty, with marriage and adoption penalties below one
  step: a four-step "your husband's brother's son" beats a five-step blood route, an adoptive parent
  is a parent rather than a distant cousin, and in-laws get their own terms. See Step 12.

**Verification:** **123 tests** at this point (5 new health tests), typecheck clean, web build 297 kB.

### Step 12 — Relationship terms families actually use ✅

**Shipped**
- Path scoring (`BASIS_PENALTY`) with blood/adoptive/foster/guardian/step/marriage weights.
- In-law classification by the blood shape of the remaining path: father's brother's wife → aunt
  (by marriage), husband's brother's son → nephew (by marriage), daughter's husband → son-in-law.
- Step-sibling detection for "a child's other parent's child" and for parent → partner → child.
- Tie-break: when two paths cost the same, prefer the one that has a term the family has a word for.
- `describePath` now compresses "father's father's son" into "father's brother" — the readable form.
- Five new tests covering in-law preference, direct spouse reporting, and the compression.

**Verification:** **130 tests passing**, typecheck clean.

### Step 13 — Keyboard navigation for the chart ✅

The chart was usable with a mouse and readable through the outline, but a keyboard user could only
Tab through cards. Movement now follows the relationships themselves:

- ↑ a parent, ↓ a child, ←/→ a partner when one lies in that direction, otherwise the next card in
  reading order — so an arrow key never silently does nothing.
- Shift+Enter re-centres the tree on the focused person; Enter opens their profile.
- A hint appears the first time a card receives focus, naming the keys.
- The movement rules live in `apps/web/src/tree/navigate.ts` as a pure function with five tests,
  because keyboard behaviour that is only tested by hand is keyboard behaviour that breaks.

**Verification:** **135 tests passing**, typecheck clean, web build 300 kB (90 kB gzip).

---

## 7. Remaining work, in priority order

Ordered by the MVP's actual question — *will relatives collaborate?* — not by how interesting the work is.

| # | Item | Feature ref | Why it is next |
|---|---|---|---|
| 1 | Real authentication (email magic link + phone OTP) and rate limiting | F-1.1 | The demo persona switcher is the single largest gap between this and a beta |
| 2 | Invitation delivery (email + WhatsApp send) with bounce/opt-out handling | F-4.2 | Links are generated but never sent, so the loop cannot be measured in the wild |
| 3 | ~~Read back your own visibility configuration~~ | F-6.2 | ✅ Step 9 |
| 4 | ~~Merge reversal from the merge log~~ | F-8.3 | ✅ Step 10 |
| 5 | Notification preferences and a real outbox for delivery | F-9.3 | Derived feed works in-product; delivery needs an idempotent outbox (ADR 0004) |
| 6 | Full localisation of screen bodies, dialogs, invite copy | F-9.2 | Shell and tree are done; the rest is English |
| 7 | Per-node branch collapse | F-3.3 | Keyboard navigation shipped in Step 13; collapsing a single branch is still pending |
| 8 | Cross-space person linking and a space switcher | post-MVP (D-2) | Needed once a user belongs to paternal, maternal and in-law spaces |
| 9 | ~~Tree health summary (missing dates, detached branches, open disputes)~~ | F-9.5 | ✅ Step 11 |
| 10 | Phase 2: memories, photographs beyond one per person, voice recordings, timeline | E9 | Only after the loop is proven |

**Not to do before the loop is proven:** DNA integrations, record search, AI biographies, native
apps, public discovery, social feeds. The MVP exit criteria in `MVP-FEATURES.md` §6 still govern.

---

<!-- NEXT STEPS APPENDED BELOW -->

---

## 3. MVP feature checklist

Derived from [`docs/MVP-FEATURES.md`](./docs/MVP-FEATURES.md) §4. A box is checked only when the acceptance criteria are demonstrably met in the running app or a passing test.

### E1 — Account and identity
- [ ] F-1.1 Authentication — `MUST` *(demo persona sessions only; real OTP/email delivery pending)*
- [ ] F-1.2 Personal profile + partial dates — `MUST`
- [ ] F-1.3 Alternative names — `SHOULD`
- [x] F-1.4 Account deletion and export — `MUST`

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
- [x] F-3.5 Compact vs detailed view — `SHOULD`
- [x] F-3.6 Accessible list fallback — `MUST`
- [x] F-3.7 Search within the tree — `SHOULD`

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
- [x] F-5.5 Disputed values — `SHOULD`
- [x] F-5.6 Revert — `SHOULD`
- [ ] F-5.7 Comments on proposals — `COULD`

### E6 — Privacy and visibility
- [x] F-6.1 Private by default — `MUST`
- [x] F-6.2 Field-level visibility — `MUST` *(projection, authoring UI, tests)*
- [x] F-6.3 Hidden branches and blocked users — `MUST` *(gates, authoring UI, tests)*
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
- [ ] F-9.2 Internationalisation and RTL — `MUST` *(shell, nav and tree controls only; screen bodies pending)*
- [ ] F-9.3 Notifications — `MUST` *(in-product feed done; delivery and preferences pending)*
- [ ] F-9.4 Data export — `MUST`
- [ ] F-9.5 Tree health summary — `COULD`
- [x] F-9.6 Abuse controls — `MUST` *(reporting, rate limits on invites; support tooling pending)*

---

## 4. Release slice plan

From [`docs/MVP-FEATURES.md`](./docs/MVP-FEATURES.md) §8, mapped to implementation steps.

| Slice | Contents | Status |
|---|---|---|
| S1 — Domain skeleton | Graph model, derivation, relationship calculator, tests | ✅ |
| S2 — Persistence + API | Repository, seed family, auth-lite, REST endpoints | ✅ |
| S3 — See it | Tree focus view, zoom/pan, expand/collapse, list fallback | ✅ |
| S4 — Invite it | Invitations, claim flow, onboarding | ✅ |
| S5 — Share it | Roles, proposals, activity log, disputes | ✅ |
| S6 — Trust it | Field-level privacy, hidden branches, separation, minors | ✅ |
| S7 — Harden | Search, duplicates, export, i18n, a11y, tree health | 🟨 i18n partial; tree health pending |

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
| 5 | ✅ clean | ✅ 100 passing | ✅ web build 284 kB (86 kB gzip) | Dispute and revert flows exercised live |
| 6 | ✅ clean | ✅ 113 passing | ✅ web build 292 kB (88 kB gzip) | Hidden-branch isolation asserted by test |
| 7 | ✅ clean | ✅ 115 passing | ✅ web build 296 kB (89 kB gzip) | Central loop asserted end-to-end over HTTP |

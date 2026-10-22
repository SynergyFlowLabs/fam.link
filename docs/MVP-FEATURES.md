# Fam Link — MVP Feature List

> **Scope document for Phase 1.** Companion to [`PRD.md`](./PRD.md).
> Anything not listed here is out of scope for the MVP, including things that feel obviously necessary.

| Field | Value |
|---|---|
| **Version** | 1.0 — Draft for review |
| **Status** | Scope proposed; awaiting sign-off |
| **Last updated** | 2026-10-22 |
| **Target** | Phase 1 — Structured family tree |
| **PRD reference** | [`PRD.md`](./PRD.md) §10 (functional requirements) |

---

## 1. How to read this document

**Priority (MoSCoW):**

| Tag | Meaning | Consequence if missing |
|---|---|---|
| **MUST** | Required for MVP launch | Do not ship |
| **SHOULD** | Important; may slip one iteration | Ship with a known gap and a plan |
| **COULD** | Nice to have if capacity allows | Cut without discussion |
| **WON'T** | Explicitly excluded this phase | Do not build |

**Sizing:** `S` ≤ 2 dev-days · `M` ≤ 5 · `L` ≤ 10 · `XL` needs a spike before commitment.

**Acceptance criteria** are written as testable statements. A feature is done when every box is checked and verified in a real family space.

---

## 2. The one question the MVP must answer

> **Will multiple relatives actively collaborate to complete and maintain the same family tree?**

Every feature below either (a) gets a first user to a recognisable tree, (b) gets a relative to join and claim a profile, (c) lets several people edit the same graph without corrupting it, or (d) makes it safe to enter sensitive information. **If a proposed feature serves none of those four purposes, it is not MVP.**

---

## 3. MVP scope boundary

### 3.1 In scope

| Area | Included |
|---|---|
| Identity | Email / phone OTP / social sign-in, profile basics, deletion, export |
| Graph | Persons, typed relationship edges, derived relationships, multiple marriages, blended families, adoption/guardian edges |
| Visualisation | Focus view, zoom/pan, expand/collapse, generation navigation, compact/detailed, list fallback |
| Onboarding | Guided question sequence ending in a first invitation |
| Growth | Link invites, email invites, WhatsApp-ready invites, relationship-contextual messaging, profile claiming |
| Collaboration | Contributions, proposals, approvals, activity log, disputes, revert |
| Privacy | Living-private-by-default, field-level visibility, hidden branches, separation requests, no public discovery |
| Intelligence | Relationship calculator with path + LCA + plain-language explanation |
| Integrity | Pre-add search, duplicate detection, authorised + reversible merge |
| Platform | Multi-space membership, i18n + RTL, accessibility (AA), audit logging, notifications (basic) |

### 3.2 Explicitly out of scope (deferred)

| Deferred | Phase | Why |
|---|---|---|
| DNA integrations | Never (v1 horizon) | Different product; different trust model |
| Historical record / government database search | Phase 4+ | Massive data-licensing effort, wrong wedge |
| AI biographies, transcription, translation | Phase 3 | Requires data volume that does not exist yet |
| Facial recognition / auto-tagging from photos | Phase 3+ | Privacy risk before trust is established |
| Native mobile apps | Post-MVP | Responsive web is sufficient to test the loop |
| Public family discovery / directory | Not planned | Contradicts the privacy stance |
| Complex inheritance calculations | Not planned | Out of product scope |
| Family health analytics / genetic risk | Not planned | Medical domain, regulatory burden |
| Full social feed, likes, comments on photos | Phase 2+ | Not the loop; invites distraction |
| Blockchain identity / verification | Not planned | No user problem solved |
| Automated lineage verification | Phase 3+ | Cannot be done credibly yet |
| Printed books, posters, memorial pages | Phase 4 | Monetisation, not validation |
| Reunion planning, family events | Phase 4 | Attractive distraction pre-validation |
| Cross-space person linking (same human, two spaces) | Phase 2 | See §7 D-2 |
| Voice memories, stories, documents | Phase 2 | **Exception:** one photo per person is MVP-adjacent (see F-2.9) |
| Timeline of family milestones | Phase 2 | Requires memories to be meaningful |
| Natural-language queries | Phase 3 | Depends on AI layer and data density |
| Cultural relationship terms beyond locale default | Phase 1.5 | See F-8.6 — the *data* support is MVP, the *terminology set* slips |

---

## 4. Feature list

### Epic E1 — Account and identity

**Goal:** A user can create an account, identify themselves, and control their own presence.

#### F-1.1 Authentication — MUST · M
- [ ] Sign up / sign in with email + password **or** magic link.
- [ ] Sign up / sign in with phone number + OTP (SMS).
- [ ] Sign in with at least one social provider (Google; Apple if iOS traffic justifies it).
- [ ] Sessions persist ≥30 days; logout from all devices available.
- [ ] Email and phone verification states are stored and displayed.
- [ ] Failed-login rate limiting; no account enumeration via error messages.
- [ ] Account recovery for both email and phone.

*PRD: FR-1.1*

#### F-1.2 Personal profile — MUST · S
- [ ] Name (given + family), display photo, birth date, birth place, living status.
- [ ] Partial dates supported (year only, month + year, full date) — required by the data model, not optional.
- [ ] Living status change converts birth date into a life span display ("1952–2019").
- [ ] Gender field is **optional** and clearly labelled as used for relationship terms only.

*PRD: FR-1.2, FR-1.3*

#### F-1.3 Alternative names — SHOULD · S
- [ ] Any person may have multiple names/nicknames (e.g. "Bilal", "Billo", "بلال").
- [ ] Alternative names are searchable and displayed on the profile.
- [ ] Name script variants (Latin/Urdu) supported per name entry.

*PRD: FR-1.4*

#### F-1.4 Account deletion and export — MUST · M
- [ ] User can delete their account in-product without contacting support.
- [ ] At deletion, the user is shown precisely what remains (structural relationship facts, contributions already accepted) and what is removed (contact details, account, media ownership).
- [ ] Deletion is reversible for 30 days, then irreversible.
- [ ] User can export their own data (profile, their contributions, media they uploaded) as a portable archive.

*PRD: FR-1.6, FR-6.5*

---

### Epic E2 — Family space and tree creation

**Goal:** In under two minutes, a user has a tree that looks like their family — and no relative is ever forced to register.

#### F-2.1 Create a family space — MUST · M
- [ ] Creating a space seeds the creator's own person record from their account profile.
- [ ] Space has a name (e.g. "Khan Family"), a default locale, and privacy defaults.
- [ ] Creator becomes the first family administrator.
- [ ] A user can belong to and switch between multiple spaces.
- [ ] Spaces are strictly isolated: no data leaks between spaces, even for the same human.

*PRD: FR-2.1, FR-2.7*

#### F-2.2 Add parents, spouses, children, siblings — MUST · L
- [ ] One-tap "add parent / add spouse / add child" from any person, plus a general "add relative" path.
- [ ] Quick-add captures only name (+ optional living status) then returns to the tree; everything else is optional enrichment.
- [ ] Siblings are created by adding a child to the same parents — **never** by storing a sibling edge.
- [ ] Spouse, partner, and former-spouse relationships are distinguishable.
- [ ] Multiple simultaneous/sequential marriages render correctly without ambiguity about which children belong to which union.
- [ ] Blended families (his children, her children, their children) are representable.
- [ ] **A person can be added with no account, no email, and no phone number.**

*PRD: FR-2.2, FR-2.3, FR-2.4*

#### F-2.3 Relationship types — MUST · M
- [ ] Stored edges: biological parent, adoptive parent, foster parent, guardian, spouse, former spouse, partner.
- [ ] Sibling, half-sibling, step-sibling, grandparent, aunt/uncle, cousin and higher-order relations are **derived** at read time.
- [ ] Edge metadata stored: effective dates (optional), created-by, source (optional), verification status, privacy scope.
- [ ] No relationship type is duplicated as both stored and derived.

*PRD: §7.3, FR-2.5*

#### F-2.4 Edit and correct any person — MUST · M
- [ ] Every field is editable by someone with authority (owner, custodian, or admin — see F-6.x).
- [ ] Editing a relationship shows a confirmation of the structural consequence ("This will move Sara's branch under Nadeem").
- [ ] Deleting a person requires a reason; deletion is soft-delete with restore for 30 days.
- [ ] Deleting a person never orphans descendants — the UI offers reparenting choices or detaches the branch with a warning.

#### F-2.5 Partial dates, places, and uncertain facts — MUST · M
- [ ] Dates: exact, month-year, year, approximate ("about 1932"), and unknown.
- [ ] Places: free text with optional structured hierarchy (city → region → country).
- [ ] Fields can be marked "disputed" rather than silently overwritten (see F-6.5).
- [ ] Uncertainty is visible in the UI ("~1932"), never rendered as false precision.

*PRD: §7.1, §11.4*

#### F-2.6 Guided onboarding — MUST · L
- [ ] Sequence: your name → parents → siblings → spouse → children → which side to expand → who can help.
- [ ] Every question is skippable; progress is preserved.
- [ ] Ends on a tree view showing the created people, with at least one clear "add more" affordance.
- [ ] Ends by generating the first invitation draft (pre-filled with a relationship phrase).
- [ ] Median time from signup to a tree with ≥5 people: ≤ 3 minutes.
- [ ] A user can abandon and resume onboarding.

*PRD: §12.1, FR-2.6*

#### F-2.7 Places lived — COULD · S
- [ ] List of places with optional date ranges, displayed on the profile.

#### F-2.8 Biography / notes — SHOULD · S
- [ ] Free-text biography field with plain-text formatting only.
- [ ] Visible per privacy scope; attribution to last editor.

#### F-2.9 Profile photo — MUST · S

- [ ] One photo per person (the MVP carve-out from the media epic).
- [ ] Upload, crop, and replace; image resized server-side.
- [ ] Photo visibility is a separate field-level control (see F-7.2).
- [ ] Sensible placeholder for people with no photo (initials, not a generic silhouette).

*PRD: FR-9.1 (partial)*

---

### Epic E3 — Interactive visualisation

**Goal:** The tree is legible at 20 people and at 2,000 — because we only ever render the part that matters.

#### F-3.1 Focus-centred tree rendering — MUST · XL
- [ ] Default view shows the selected person with a configurable depth (default: 2 generations up, 2 down, siblings visible).
- [ ] The same person may appear twice when reachable by two paths (cousin marriage) — both instances render, clearly marked, without infinite recursion.
- [ ] Cycles in the graph never hang the renderer; a visited set is enforced.
- [ ] Visible node count is capped with a "load more" affordance rather than an unbounded render.
- [ ] Renders correctly for 1 person (single node) with no layout artefacts.

#### F-3.2 Zoom, pan, and layout — MUST · L
- [ ] Pinch, wheel, and button zoom; drag to pan; "fit to screen" and "reset" controls.
- [ ] Touch targets ≥44px; panning does not trigger accidental person selection.
- [ ] Layout is deterministic: the same graph produces the same layout across sessions.
- [ ] Layout keeps couples adjacent and children beneath their union.

#### F-3.3 Expand and collapse branches — MUST · M
- [ ] Any node with hidden relatives shows an expand affordance with a count ("+7 more").
- [ ] Expanding loads that branch without re-laying-out the entire visible view disorientingly.
- [ ] Collapse returns to the exact prior viewport.

#### F-3.4 Generation navigation — MUST · M
- [ ] Buttons to move focus up one generation, down one generation, and to a sibling/spouse.
- [ ] Keyboard navigation across the tree (arrow keys + enter).
- [ ] A breadcrumb trail of the current focus path.

#### F-3.5 Compact vs. detailed view — SHOULD · M
- [ ] Compact: name + relation label + photo thumbnail.
- [ ] Detailed: adds birth/death years and place (respecting field-level privacy).
- [ ] View preference persists per user per space.

#### F-3.6 Accessible list fallback — MUST · M
- [ ] Every tree view has an equivalent outline view (indented, screen-reader navigable).
- [ ] Relationship information is available as text for any rendered edge.
- [ ] Meets WCAG 2.1 AA for contrast, focus visibility, and keyboard operation.
- [ ] Respects `prefers-reduced-motion`.

*PRD: §11.4, FR-3.x*

#### F-3.7 Search within the tree (visual) — SHOULD · S
- [ ] Highlight and jump to a person from the tree view without leaving it.

---

### Epic E4 — Invitations and claiming

**Goal:** A relative joins because of who they are in the tree, and corrects their own record instead of creating a second one.

#### F-4.1 Shareable invite link — MUST · M
- [ ] Admin (or any member, if the space allows) generates a link scoped to a specific person or branch.
- [ ] Links are revocable, expiring (default 14 days), and single-purpose.
- [ ] Opening a link shows the invited relationship and a preview of the relevant branch *before* any signup.
- [ ] Link previews never expose fields the invitee would not be permitted to see.

*PRD: FR-4.1*

#### F-4.2 Email invitation — MUST · M
- [ ] Subject and body contain the relationship context and inviter name.
- [ ] Body includes a rendered branch preview image of the invitee's position.
- [ ] One-click "not me / wrong person" escape hatch in the email.
- [ ] Bounce and complaint handling.
- [ ] Unsubscribe works globally and per space.

*PRD: FR-4.2*

#### F-4.3 WhatsApp-friendly invitation — MUST · S
- [ ] "Share via WhatsApp" produces a plain-language message with relationship context and the scoped link (works with WhatsApp Web/desktop and mobile share sheets).
- [ ] Message text is localised and gender/relationship-aware.
- [ ] Link preview (OG tags) shows family name and relationship, never private data.

*PRD: FR-4.3*

#### F-4.4 Claim an existing profile — MUST · L
- [ ] Invitation for an existing unclaimed person routes directly into the claim flow, not into "create a new person".
- [ ] Claimant sees the existing record, can confirm it, correct it, or reject it.
- [ ] Claim requires identity verification via verified email/phone plus admin approval (or an explicitly documented fallback when no admin responds within 7 days).
- [ ] On successful claim: self-ownership of protected fields transfers to the claimant, previous custodian is notified, and the event is logged.
- [ ] If the claim is contested, the profile enters `disputed` and an admin resolution flow opens.
- [ ] Claimant can, in the same flow, hide themselves from named members/branches.

*PRD: FR-4.4, §8.5*

#### F-4.5 Assign expected relationship at invite time — MUST · S
- [ ] Inviter picks (or confirms) the invitee's relationship before sending ("maternal uncle").
- [ ] Accepted invitation materialises or confirms the corresponding edge automatically.
- [ ] If the invitee corrects the relationship, the correction is recorded as a proposal with the inviter notified.

*PRD: FR-4.5*

#### F-4.6 Invitation management — MUST · M
- [ ] Invitation list with status: sent, opened, accepted, claimed, declined, expired, revoked.
- [ ] Resend and revoke per invitation.
- [ ] Rate limits: per inviter per day, per space per week; hard block on repeat-declined addresses.
- [ ] A declined invitation is never automatically re-sent.

*PRD: FR-4.6, FR-4.7, §6*

---

### Epic E5 — Collaborative editing and governance

**Goal:** Many people edit the same graph without corrupting it, and disagreements become data instead of damage.

#### F-5.1 Roles — MUST · L
- [ ] Five roles exist and are enforced server-side: **owner, custodian, family admin, contributor, viewer**.
- [ ] Precedence is implemented exactly as specified in PRD §8.2 (owner-self > custodian > admin > contributor > viewer).
- [ ] A person can hold different roles in different spaces.
- [ ] Admin can appoint/remove custodians and promote/demote members.
- [ ] A living claimed person's self-set field visibility cannot be overridden by an admin.

*PRD: §8.2*

#### F-5.2 Propose an edit — MUST · L
- [ ] Contributors can propose additions and corrections on visible people.
- [ ] A proposal stores field, previous value, proposed value, contributor, timestamp, and a required short explanation.
- [ ] Proposals can attach one piece of evidence (photo, document reference, or URL) — optional.
- [ ] Owner/custodian/admin sees a review queue per person.
- [ ] Approve → value applied, previous value archived. Reject → reason optional but prompted.
- [ ] Proposer is notified of the outcome.

*PRD: FR-5.1, FR-5.4, §8.4*

#### F-5.3 Direct edit within authority — MUST · M
- [ ] Owners edit their own fields directly (no proposal needed).
- [ ] Custodians edit directly on managed profiles.
- [ ] Admins edit structural/duplicate matters directly.
- [ ] Contributors editing a **non-protected** field of an unclaimed person apply directly but are logged and reversible.
- [ ] Protected fields (PRD §8.3) always require owner approval; the UI explains why.

*PRD: FR-5.2, FR-5.3*

#### F-5.4 Activity log — MUST · M
- [ ] Every accepted change records: actor, action, target, before, after, timestamp, scope.
- [ ] Log is visible to all space members, filtered by person or by space.
- [ ] Log entries describe the change in human language ("Ayesha changed Nadeem's birth year from 1958 to 1959").
- [ ] Log is append-only; entries are never edited or deleted.
- [ ] Log entries respect current privacy scope (a hidden person does not leak through the log).

*PRD: FR-5.5*

#### F-5.5 Disputed values — SHOULD · L
- [ ] When two members assert different values for the same field, both are retained and the field is marked `disputed`.
- [ ] The UI shows both values, both sources, and who proposed each.
- [ ] An admin can resolve by selecting a value, marking both (e.g. "1958 (per Ayesha) / 1959 (per Nadeem)"), or leaving open.
- [ ] Resolution is logged; the losing value remains retrievable.

*PRD: FR-5.6, §13 risk 3*

#### F-5.6 Revert — SHOULD · S
- [ ] Any accepted change can be reverted by an authorised actor; the revert is itself logged.

*PRD: FR-5.8*

#### F-5.7 Comment on a proposal — COULD · S
- [ ] Threaded comments on a proposed edit, visible to reviewers.

---

### Epic E6 — Privacy and visibility

**Goal:** Entering a living relative's information is safe enough that people actually do it.

#### F-6.1 Private by default — MUST · M
- [ ] Every new living person defaults to the most restrictive visibility appropriate to the space.
- [ ] New living people are hidden from anyone outside the space.
- [ ] No person or profile is publicly discoverable unless the space explicitly opts in (and opt-in is off by default, with a confirmation screen).

*PRD: FR-6.1, FR-6.4, §9.3*

#### F-6.2 Field-level visibility — MUST · L
- [ ] Per-field visibility for: exact birth date, phone, address, documents, photos, medical info, minors' details, relationship disputes.
- [ ] Visibility scopes: only me · selected relatives · immediate family · entire space · private link · public (PRD §9.1).
- [ ] Server-side enforcement at field level — verified by an API test that a restricted field is absent from the response, not merely hidden in the UI.
- [ ] Profile shows an effective summary ("3 fields hidden from 4 relatives").
- [ ] One-tap "who can see this?" from any field.

*PRD: FR-6.2, §9.2*

#### F-6.3 Hidden branches and blocked users — MUST · L
- [ ] A member can hide an entire subtree from a named member or group.
- [ ] A blocked user cannot see the blocker's presence, fields, or invitations, in either direction.
- [ ] Hidden people do not appear in search results, tree counts, relationship paths, or notifications — including indirectly (no "you are related through someone you cannot see" leaks).
- [ ] Path calculation that would traverse a hidden person returns "no visible connection" rather than an error.

*PRD: FR-6.3, FR-6.6, §9.4*

#### F-6.4 Separation and removal requests — MUST · L
- [ ] Any person (claimed or via their custodian) can request separation from a tree/space.
- [ ] Separation hides the live record without destroying established historical facts; a suppression marker is retained.
- [ ] Admin receives the request; non-response escalates to automatic separation after 14 days.
- [ ] The requesting person is told exactly what other members will and will not see afterwards.
- [ ] Adoption/guardianship privacy: the *nature* of the relationship can be hidden while the relationship itself remains.

*PRD: FR-6.5, §9.4*

#### F-6.5 Minors — MUST · M
- [ ] A profile marked as a minor (derived from birth date, or explicitly flagged) is restricted to immediate family by default.
- [ ] Minors can never be made public.
- [ ] Guardian/custodian controls all visibility for a minor.

*PRD: §9.4*

#### F-6.6 Photo permissions — SHOULD · M
- [ ] Tagging a living person in a photo requires their approval (or their custodian's).
- [ ] Declined tags are not shown to the decliner again; the photo may remain untagged.
- [ ] Removing a tag does not delete the photo, but re-tagging requires fresh approval.

*PRD: FR-6.7*

---

### Epic E7 — Relationship calculator

**Goal:** The feature people show each other at weddings. It should be fast, correct, explainable, and shareable.

#### F-7.1 Relationship between any two people — MUST · L
- [ ] Select two visible people → get their relationship.
- [ ] Handles: lineal (ancestor/descendant, any depth), siblings, half-siblings, aunts/uncles, nieces/nephews, cousins (1st–Nth, removed), in-laws, step-relations, adoptive relations.
- [ ] Multi-path relationships resolve by defined ordering: blood > adoptive > step > guardian, then shortest path, then configured tie-break.
- [ ] Cycles and cousin-marriage cases return all equally close answers rather than an arbitrary one.
- [ ] Result states the *assumption basis* ("by blood", "through adoption").
- [ ] Performance: <300ms p95 at 10k people per space.

*PRD: FR-7.1*

#### F-7.2 Path and common ancestor — MUST · M
- [ ] Displays the connection path visually on the tree.
- [ ] Names the nearest common ancestor(s), with generation counts on each side.
- [ ] Handles multiple LCAs (shows all within equal distance).

*PRD: FR-7.2*

#### F-7.3 Plain-language explanation — MUST · S
- [ ] One-sentence explanation with the full chain: "Sara is your father's brother's daughter, making her your first cousin."
- [ ] Explanation is generated from the graph, never from a template library of fixed phrases only.
- [ ] Explanation localised to the user's locale.

*PRD: FR-7.3*

#### F-7.4 "How am I related to…" shortcut — MUST · S
- [ ] Available on every person profile.
- [ ] Also available as a first-class entry point ("Relationship calculator" in navigation).

*PRD: FR-7.4*

#### F-7.5 Shareable result — SHOULD · M
- [ ] Generates a privacy-scrubbed card (first names + relationship only; no dates, no contact info, no photos of others without consent).
- [ ] Preview of exactly what will be shared before sharing.
- [ ] Share link expires.

*PRD: FR-7.5*

#### F-7.6 Locale-aware kinship terminology — SHOULD · L
- [ ] Relationship terms render in the space's/user's locale.
- [ ] Data model distinguishes paternal/maternal and elder/younger where the locale requires it.
- [ ] Term overrides per family space are supported by the data model (UI may follow in Phase 1.5).

*PRD: FR-11.1 – FR-11.4*

---

### Epic E8 — Search and duplicate prevention

**Goal:** The family never forks into two versions of the same uncle.

#### F-8.1 Search people before adding — MUST · M
- [ ] Typing a name for a new person immediately searches existing people in the space (and shows likely matches before creation).
- [ ] Search matches alternative names, transliterations, and near spellings (edit distance / phonetic).
- [ ] Search respects visibility scope and never confirms the existence of hidden people.
- [ ] Empty results are shown clearly ("No match — create new").

*PRD: FR-8.1*

#### F-8.2 Duplicate detection — MUST · L
- [ ] Signals used: name similarity + overlapping relationships (shared parent/spouse/child) + birth year proximity + place.
- [ ] Candidates surface at two moments: **before** creation (preventive) and in a periodic admin review queue (curative).
- [ ] Relationship overlap is weighted far above name similarity.
- [ ] Scoring is explainable in the UI ("same mother, same birth year, similar name").
- [ ] False-positive rate is monitored; users can dismiss a candidate permanently.

*PRD: FR-8.2, FR-8.3, §13 risk 4*

#### F-8.3 Merge — MUST · L
- [ ] Merge UI presents field-by-field choice between the two records.
- [ ] Merge unions relationships, media, and memories without creating duplicates.
- [ ] Merge requires authorisation per PRD §8.6; merging a living claimed person requires their consent.
- [ ] Merge is reversible from the merge log for 30 days, restoring both records with their edges intact.
- [ ] All merge participants are notified.

*PRD: FR-8.4*

#### F-8.4 Global person search within a space — SHOULD · S
- [ ] A people directory with search, filter by branch, filter by living/deceased, and alphabetical browse.

---

### Epic E9 — Platform essentials

**Goal:** Trust, reach, and operability.

#### F-9.1 Audit logging — MUST · M
- [ ] Immutable audit trail for: role changes, claims, merges, visibility changes, deletions, exports, admin overrides.
- [ ] Distinguish user-facing activity log (F-5.4) from system audit log (internal, retained longer, tamper-evident).
- [ ] Admin can view the audit trail for their space.

#### F-9.2 Internationalisation and RTL — MUST · L
- [ ] All strings externalised; no hard-coded user-facing text.
- [ ] Full RTL layout mirroring for the tree view, forms, and email templates.
- [ ] Locale-aware date, name-order, and number formatting.
- [ ] Language switchable per user without losing session state.

*PRD: §11.4*

#### F-9.3 Notifications — MUST · M
- [ ] Email/in-app notifications for: invitation received, invitation accepted, claim requested, claim approved, proposal awaiting review, proposal decided, duplicate suggested, role changed.
- [ ] Per-category notification preferences.
- [ ] Digest option to avoid notification fatigue.
- [ ] Notifications never include content the recipient is not permitted to see.

*PRD: FR-10.1 – FR-10.5 (subset)*

#### F-9.4 Data export — MUST · M
- [ ] Space admin can export the whole space to an open, documented format (GEDCOM-compatible subset + media manifest + relationship metadata).
- [ ] Export respects the exporter's visibility scope.
- [ ] Export is logged.

*PRD: §11.6*

#### F-9.5 Tree health summary — COULD · S
- [ ] Shows completeness signals (people with no dates, no photo, unconnected branches, unresolved duplicates).

#### F-9.6 Abuse controls — MUST · M
- [ ] Report a profile, user, or invite.
- [ ] Rate limiting on invites, claims, searches, and account creation.
- [ ] Support tooling to resolve claims and disputes.

---

## 5. Cross-cutting requirements (apply to every feature)

| Requirement | Standard |
|---|---|
| **Authorisation** | Enforced server-side on every request, at field granularity. No client-side-only checks. |
| **Auditability** | Any state change to a person, edge, role, or visibility is logged. |
| **Accessibility** | WCAG 2.1 AA; keyboard-complete; screen-reader parity via list view. |
| **Performance** | Tree focus view interactive ≤1.5s on mid-range Android/4G; relationship calc <300ms p95. |
| **Mobile-first** | Designed for a 390px viewport first; desktop is a progressive enhancement. |
| **Privacy** | No PII in logs, analytics events, or error traces. No hidden person leaks through counts or paths. |
| **Localisation** | No hard-coded user-facing strings; RTL-safe components. |
| **Resilience** | Photo/upload retries; no data loss on flaky connections; optimistic edits reconciled. |
| **Testability** | Domain model covered by unit tests for edge cases: cycles, multi-path, multiple LCAs, blended families, adoption. |

---

## 6. MVP exit criteria (definition of done for Phase 1)

Ship only when **all** of the following are true:

1. **Activation:** ≥60% of new users add ≥5 relatives in their first session; ≥40% reach three generations.
2. **Loop proof (primary):** ≥20% of beta family spaces have **≥3 distinct contributing relatives within 30 days**.
3. **Claim works:** A relative can go from invitation → account → claimed profile with corrections in under 5 minutes, without creating a duplicate person.
4. **Integrity:** Zero duplicate persons created in the beta by members who used the pre-add search; every duplicate detected is resolvable and reversible.
5. **Privacy proof:** A security review confirms no field-level visibility bypass via API, tree counts, search, relationship paths, or notifications.
6. **Graph correctness:** Domain tests pass for at least: half-siblings, step-siblings, double cousins, cousin marriage, adoption chains, multiple LCAs, and deceased-person chains 6 generations deep.
7. **Relationship calculator:** ≥30% of activated users use it at least once; explanation rated "correct" in ≥90% of sampled checks.
8. **Removal safety:** A person can be separated from a tree without destroying that tree's historical integrity.

---

## 7. Decision log (scope changes)

| ID | Decision | Status | Rationale |
|---|---|---|---|
| D-1 | Siblings/half-siblings/step-siblings are **derived, never stored** | Decided | Storing them permits contradictions after any parent correction |
| D-2 | Cross-space person linking is **post-MVP** | Decided | Adds consent complexity without testing the core loop |
| D-3 | One photo per person **is** MVP; galleries are not | Decided | Identity recognition at low cost |
| D-4 | Voice memories are **Phase 2**, not MVP | Decided | Requires media pipeline + storage economics |
| D-5 | Cultural kinship terms: **data model in MVP, full term set in Phase 1.5** | Decided | Model change later would be expensive; term curation is slow |
| D-6 | No public-facing tree surface at all in MVP | Decided | Privacy is the differentiator; public discovery is a separate bet |
| D-7 | Phone OTP is MVP (not email-only) | Decided | Target market relies on phone numbers more than email |
| D-8 | Premium/paid tier **not** built in MVP | Decided | Validate the loop before monetising; no feature behind a paywall that affects the loop |

---

## 8. Suggested release slices

Sequenced so each slice can be tested with real families.

| Slice | Contents | Testable question |
|---|---|---|
| **S1 — Skeleton** | E1 auth + profile, E2 create space / add people / relationships / partial dates, basic list view | Can a person enter 15 relatives without friction? |
| **S2 — See it** | E3 focus tree, zoom/pan, expand, generation nav, list fallback | Do users recognise their family at a glance? |
| **S3 — Invite it** | E4 invite links/email/WhatsApp, F-4.4 claim, onboarding ending in invite | Will a relative accept an invitation that names their relationship? |
| **S4 — Share it** | E5 roles, proposals, activity log, disputes | Can three relatives edit one graph without breaking it? |
| **S5 — Trust it** | E6 privacy (field-level, hidden branches, separation, minors), E6.6 photo permissions | Will people add living relatives when privacy is explicit? |
| **S6 — Understand it** | E7 relationship calculator + shareable card, E8 search and duplicates | Is the calculator the feature users show others? |
| **S7 — Harden** | E9 audit, i18n/RTL, notifications, export, abuse controls, performance | Can it be operated and supported? |

---

## 9. Explicitly rejected for MVP (and why)

| Rejected idea | Why not now |
|---|---|
| AI-generated biographies | Requires a corpus the MVP does not have; risks fabricating family history before trust exists |
| Timeline view | Inert without memories; a thin timeline adds surface area without value |
| Family chat / messaging | WhatsApp already owns this; competing with it dilutes focus |
| "Gamification" (badges, streaks) | Wrong tone for a memorial/archival context; feels exploitative to elders |
| Public shareable "family tree page" for SEO growth | Directly contradicts the privacy promise and invites scraping of living people's data |
| Bulk import from GEDCOM at launch | Attracts genealogy hobbyists, not the collaborative families we need to validate with |
| Editable graph canvas (drag nodes freely) | Users expect layout to be automatic; manual layout becomes a maintenance burden |
| Video memories | Storage-heavy, production-heavy; voice proves the behaviour at a fraction of the cost |
| Inheritance/permission inheritance chains | Complexity for an edge case; flatten custody instead |

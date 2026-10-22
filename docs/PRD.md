# Fam Link — Product Requirements Document

| Field | Value |
|---|---|
| **Product** | Fam Link (`fam.link`) |
| **Document** | Product Requirements Document (PRD) |
| **Version** | 1.0 — Draft for review |
| **Status** | Ready for engineering discovery |
| **Last updated** | 2026-10-22 |
| **Owner** | Product |
| **Related docs** | [`MVP-FEATURES.md`](./MVP-FEATURES.md) · [`../README.md`](../README.md) |

---

## 1. Executive summary

Fam Link is a **private, collaborative family knowledge network**. Families build an unlimited multigenerational family graph together — each relative contributing the part they actually know — while photographs, stories, voice recordings, documents, and historical detail accumulate against the people they belong to.

The product solves two linked problems:

1. **Relationship discovery** — who belongs to my family, and how is everyone connected?
2. **Family preservation** — what knowledge, memories, and history should survive into the next generation?

The wedge is deliberately narrow: *create your family tree, invite relatives, and let every branch complete itself.* Existing genealogy products are built around one researcher and historical records. Fam Link is built around **many living relatives, each owning a slice of the truth**, with privacy and ownership modelled as first-class product concepts rather than settings.

The central bet: families will return to correct, enrich, and maintain a shared family record if the invitation is meaningful, the privacy is trustworthy, and contribution is easier than not contributing.

**One-sentence pitch.** A private, collaborative web platform where families build and preserve their complete multigenerational network — add relatives without requiring them to register, invite them to claim their own profiles and complete their branches, discover how any two people are related, and preserve the photos, stories, and documents behind every connection.

---

## 2. The problem

Family information is fragmented across the memories of older relatives, family WhatsApp groups, physical photo albums, diaries, government records, and separate branches of an extended family that rarely talk to each other.

That fragmentation produces concrete, recurring failures:

| Failure | What it looks like |
|---|---|
| **Extended-family blindness** | A 20-year-old cannot name their grandparents' siblings, let alone place a second cousin. |
| **Irreversible loss** | When a grandparent dies, an unrecorded branch, a migration story, and the names behind a shoebox of photographs disappear with them. |
| **Contradiction and duplication** | Three relatives hold three birth dates for the same uncle; the same cousin is added twice under different spellings. |
| **Context-free archives** | Photographs live in a camera roll with no names, no dates, no places, no relationships. |
| **Impossible single authorship** | No one person knows enough to build the whole tree. The person who cares most is usually not the person who knows most. |
| **Unsafe social tools** | Conventional social networks cannot express "this is my step-father, do not show this branch to my mother's side." |

**Why now.** Extended families are geographically distributed and already coordinate in messaging groups; smartphones and voice notes make contribution possible for non-typing elders; and the generation that holds the oral history is ageing out.

---

## 3. Vision, positioning, and non-goals

### 3.1 Long-term vision

Become the private digital home for every family — preserving its people, relationships, memories, documents, and collective history across generations.

### 3.2 Positioning

Fam Link is the combination of:

- a **collaborative family tree**
- a **private family network**
- a **generational archive**
- a **relationship discovery engine**
- a **family history knowledge base**

**Tagline:** *Build your family tree together. Preserve the people and stories behind every connection.*

**Emotional framing:** *Every family carries stories that disappear when nobody records them. Build the family tree together, connect every generation, and preserve the people, memories, and history that made the family what it is.*

### 3.3 Explicit non-goals (v1 and near term)

- **Not** an ancestry/DNA research tool. No DNA integrations, historical record search, or government database lookups in the MVP.
- **Not** a social network. No public feeds, follower graphs, likes, or algorithmic discovery.
- **Not** a public directory of families. No public discovery of people or trees without explicit opt-in.
- **Not** an inheritance, legal, or medical-advice product. No inheritance calculations or health/genetic risk analysis.
- **Not** a mobile app in v1. Responsive web first.
- **Not** a verification authority. Fam Link records *claims, sources, and disagreements*; it does not adjudicate biological truth.

### 3.4 Product principles

1. **Contribution beats completeness.** A partly-filled tree with five contributors beats a perfect tree with one author.
2. **The relationship is the invitation.** People join because of who they are in the tree, not because of a generic platform pitch.
3. **Private by default.** Every living person starts private. Access is granted, never assumed.
4. **Never silently overwrite.** Disagreement is data, not an error to be erased.
5. **Propose, never impose.** Machines (and most humans) suggest; owners and administrators decide.
6. **The graph is the truth; the UI is a view.** The interface may say "tree"; the system stores a graph.
7. **Two minutes to recognition.** A new user must see a family structure they recognise before they are asked to invest effort.
8. **Cultural fluency is a feature, not a translation.** Kinship terms must be precise in the user's own idiom.

---

## 4. Target users

### 4.1 Initial segment

**Large, geographically distributed South Asian families** documenting extended relationships and preserving family history.

Why this segment first:

- Large extended-family structures and high awareness of precise kinship relationships.
- Relatives distributed across cities and countries, already coordinating in messaging groups.
- Multilingual requirements (Urdu, Hindi, Bengali, Arabic, English) and a real need for precise relationship vocabulary.
- Historical family information is weakly organised and time-sensitive.
- Strong invitation culture: a family reunion or a wedding creates a natural, dated reason to act.

**Beachhead use case:** *"Invite your relatives and map your extended family before the next family reunion."*

### 4.2 Personas

| Persona | Role in product | Goals | Fears | Success looks like |
|---|---|---|---|---|
| **The Organiser** (38, eldest daughter, diaspora) | Primary creator, family administrator | Get the whole family into one place before it's too late | Doing all the work alone; getting details wrong in public | 3+ relatives contributing within 30 days |
| **The Keeper** (72, retired, native-language-first) | Custodian of oral history, low typing comfort | Pass on stories, correct what's wrong | Being misrepresented; technology being too hard | Records 3 voice memories; profile claimed and accurate |
| **The Claimant** (29, invited cousin) | Invited contributor | See how they're connected; fix their own details | Privacy — "who can see my phone number?" | Claims profile, corrects dob, adds spouse and children |
| **The Sceptic** (45, parent) | Reluctant joiner, gatekeeper for a minor | Protect children's information | Photos and dates of kids leaking; family politics | Grants scoped visibility; no unwanted exposure |
| **The Explorer** (17, grandchild) | Read-mostly consumer | Understand who everyone is at a wedding | — | Uses relationship calculator 5×/month; browses memories |

### 4.3 Jobs to be done

- *When* I meet a relative I can't place, *I want to* see exactly how we're connected, *so I can* address them correctly and not embarrass myself.
- *When* an elder starts telling a story, *I want to* capture it against the right person, *so it* outlives the moment.
- *When* I'm invited to a family tree, *I want to* see my own place in it and fix what's wrong, *so it* represents me accurately.
- *When* I add an uncle, *I want to* be sure he isn't already in the tree, *so we* don't fork into duplicate people.
- *When* my family disagrees about a date, *I want* the disagreement recorded with sources, *so we* stop overwriting each other.

---

## 5. Goals, success metrics, and non-goals

### 5.1 MVP goal

Enable a user to **construct, explore, and collaboratively expand a family tree without creating duplicate or conflicting records.**

### 5.2 The question the MVP must answer

> **Will multiple relatives actively collaborate to complete and maintain the same family tree?**

Everything in [`MVP-FEATURES.md`](./MVP-FEATURES.md) exists to answer that question. If the answer is no, no amount of AI, DNA, or record search rescues the model.

### 5.3 North-star and supporting metrics

**North star:** *Collaborative family spaces* — family spaces with ≥3 distinct contributing relatives in the trailing 30 days.

| Layer | Metric | MVP target | Notes |
|---|---|---|---|
| Activation | % of new users who add ≥5 relatives in first session | ≥ 60% | Requires guided onboarding, not empty canvas |
| Activation | % who reach 3 generations | ≥ 40% | Leading indicator of a "real" tree |
| Activation | Median time to first invitation sent | ≤ 10 min | Invitation is the growth act |
| Activation | % who recognise a meaningful tree at onboarding end | ≥ 70% | Survey prompt at end of onboarding |
| Collaboration | Invitations sent per activated user | ≥ 3 | |
| Collaboration | Invitation acceptance rate | ≥ 25% | Context-rich invites only |
| Collaboration | % of invited profiles claimed | ≥ 30% | |
| Collaboration | Contributors per family space | ≥ 3 in 30 days | **Primary success metric** |
| Collaboration | % of trees with >1 editor | ≥ 35% | |
| Value | Profiles completed (name, dates, ≥1 relationship, photo) | ≥ 50% of added people | |
| Value | Memories uploaded per family space / month | ≥ 5 | Phase 2 gate |
| Value | Duplicate candidates resolved | ≥ 60% of detected | Trust signal |
| Retention | Family spaces active at D30 / D90 / D180 | 35% / 25% / 18% | Beta-stage targets, to be rebaselined |
| Retention | % of family spaces receiving a monthly update | ≥ 40% | Recurring-value proof |
| Retention | Return activity within 7 days of a birthday/reunion prompt | ≥ 20% | Tests the recurring-value thesis |

### 5.4 Non-goals for success measurement

We will not optimise for total registered users, session length, or content volume. A family space with 3 active relatives is worth more than 100 passive signups.

---

## 6. The central product loop

```
User creates family space
        │
        ▼
User adds known relatives (registration NOT required)
        │
        ▼
Platform generates contextual invitations for those people
        │
        ▼
Relative opens invite → sees their own place in the tree → claims profile
        │
        ▼
Relative corrects details + adds their side of the family
        │
        ▼
New relatives appear → new invitations generated
        │
        └──────────► tree becomes more valuable → more participation
```

**Network effect:** each new participant typically contributes several previously unknown connections. Growth is linear in invitations sent but super-linear in tree value per invitation, because later invitees join a visibly richer tree.

**Invitation quality is the loop's weak point.** The invitation must carry relationship context and a preview:

> **Ahmed added you as his maternal uncle in the Khan family tree.**
> Claim your profile and help complete your branch.
> *[See your place in the tree →]*

Not:

> Ahmed invited you to join Fam Link.

**Invitation-fatigue guardrails:** rate-limit per inviter, cap unaccepted invites per family space per week, honour global opt-out, and never re-invite a declined address without a manual, individual action.

---

## 7. Product model

Four concepts must remain distinct in both the product and the codebase.

### 7.1 Person

A human represented in the graph. A person exists whether or not anyone has registered or claimed them.

| Attribute | Notes |
|---|---|
| Living / deceased | Drives privacy defaults and UI treatment |
| Registered / unregistered | Registration is optional |
| Claimed / unclaimed | Claim links a user account to a person |
| Public-in-family / restricted | Visibility scope |
| In one or many family spaces | Same person can be linked across spaces (with consent) |

Identity fields: given names, family name, alternative/nickname names (free-text list, searchable), optional gender (only where needed to generate relationship terms), birth/death date and place, photo, living status, biography.

### 7.2 User account

A registered person. **Not every person needs an account** — users must be able to create profiles for deceased relatives, children, grandparents, and relatives who don't use technology.

Separating account from person is what allows a tree to be complete while registration remains optional. A person may be created and later *claimed* by a registering user.

### 7.3 Relationship

A typed, usually directional edge between two people.

| Relationship | Direction | Cardinality | Notes |
|---|---|---|---|
| Biological parent | Parent → child | Many-to-many | Core generative edge |
| Adoptive parent | Parent → child | Many-to-many | Privacy-sensitive |
| Foster parent | Parent → child | Many-to-many | Privacy-sensitive |
| Guardian | Guardian → dependent | Many-to-many | May be temporary |
| Step-parent | Parent → child | Many-to-many | Derivable from spouse + parent in many cases |
| Spouse | Symmetric | One active at a time | Effective dates matter |
| Former spouse | Symmetric | Historical | Enables remarriage modelling |
| Partner | Symmetric | — | Non-marital, ongoing |
| Sibling | — | — | **Derived** from shared parent, not stored |
| Half-sibling | — | — | **Derived** from one shared parent |
| Step-sibling | — | — | **Derived** from parents' spouses |

**Derivation rule (architecturally binding):** store the minimum sufficient edge set. Parent-child, spouse/partner/former-spouse, and guardianship are stored. Siblings, half-siblings, step-siblings, grandparents, aunts/uncles, cousins, and all higher-order relationships are computed. Storing derived relationships creates irreconcilable contradictions (e.g. a sibling row surviving a parent correction).

**Edge metadata:** effective start/end dates, confidence, source/evidence, verification status, privacy scope, created-by, superseded-by.

### 7.4 Family space

A shared environment binding together: members, tree data, photos, stories, documents, permissions, activity history, and administrators.

- A user may belong to multiple family spaces (paternal, maternal, spouse's family, an independently maintained historical branch).
- **Monetisation unit and permission boundary** is the family space, not the individual.
- A family space owns its privacy defaults, naming, locale, and kinships terminology.
- Person records may be *linked* across spaces (identifying the same human) while their data and permissions stay separately governed.

### 7.5 Tree vs graph

Technically this is **not a tree** — it is a graph. Real families contain multiple marriages, divorces, half-siblings, step-relations, adoption, guardianship, cousin marriage, and overlapping paternal/maternal branches where the same ancestor appears via multiple paths.

The domain model must therefore be: **person nodes + typed relationship edges**, with directional parent-child connections, effective dates, verification metadata, and privacy metadata. The interface may say "family tree"; the backend must never assume single-parentage or acyclic ancestry.

**Consequences for engineering:**
- Traversals must be cycle-safe and depth-bounded.
- "Nearest common ancestor" must handle multiple LCAs (return all within equal distance and explain path divergence).
- The relationship calculator must handle multi-path relationships and pick the closest by a defined ordering (blood > adoptive > step > guardian; then shortest path; then explicit tie-break rule).
- Visualisation must render a *focus window*, never the whole graph.

---

## 8. Authority and data ownership

**This is the hardest problem in the product** — not drawing nodes and lines, but deciding who may create, edit, approve, merge, hide, or delete information about another person.

### 8.1 The scenario that must not break

1. One user creates a profile for an uncle.
2. Another relative edits the uncle's birth date.
3. The uncle registers and claims the profile.
4. Two family administrators disagree about the correct information.
5. The uncle wants his profile hidden from some relatives.
6. The same uncle already exists in another tree.

### 8.2 Authority hierarchy

| Role | Scope | Can do | Cannot do |
|---|---|---|---|
| **Profile owner** | A registered person, about themselves | Edit all fields on own profile; set visibility per field; approve/deny others' proposals; hide self from specific members or branches; request separation from a space | Delete other members' data; remove historical edges unilaterally in disputed cases |
| **Custodian** | A trusted relative managing a profile for a child, elder, deceased person, or non-user | Edit the managed profile; approve proposals on it; grant/transfer custody | Edit protected fields of a living claimed person |
| **Family administrator** | Whole family space | Manage memberships; appoint custodians; resolve duplicates; adjudicate disputed edits; configure space privacy defaults; archive space | Override a living owner's own self-set visibility |
| **Contributor** | Space member | Propose additions/edits to any visible person; add new relatives; attach memories; comment on disputes; invite | Unilaterally change protected fields; delete people |
| **Viewer** | Space member or link holder | Explore permitted portions; view memories within scope | Edit or propose |

**Precedence:** profile owner (about self) > custodian (about a dependent) > family administrator (structural/dispute matters) > contributor > viewer. An administrator may resolve a *dispute* but may not publish a living owner's private field against their will.

### 8.3 Protected fields

Fields that require owner approval when the person is a living, claimed user: exact birth date, contact details, address, medical information, photographs, personal documents, current location, and relationship edges involving the person themselves.

### 8.4 Change management

For every important change, persist:

| Field | Purpose |
|---|---|
| Previous value | Enables diff and revert |
| Proposed value | The claim under review |
| Contributor | Accountability |
| Timestamp | Provenance |
| Evidence / explanation | Converts argument into verifiable claim |
| Approval status | `proposed` → `accepted` / `rejected` / `disputed` / `superseded` |

This turns family arguments into manageable data disputes rather than silent overwrites. There is no "last write wins" on protected fields.

### 8.5 Profile claiming

```
Unclaimed ──claim request──► Pending ──approve──► Claimed
    │                             │                 │
    │                        reject (requester      └─► Disputed (ownership contested)
    │                         may re-request         │
    │                         once)                  └─► Under review by admin
    └──► (admin can also pre-assign custodian)
```

Claiming requires verification of identity by a channel we can actually check (email/SMS to the account, plus a knowledge check where available) and either administrator approval or a documented trust fallback. A successful claim **transfers control of sensitive fields** from custodian/admin to the person, and automatically notifies the previous custodian.

**Claim is the emotional peak of the product.** The claimant must be able to say "this is not me," "this is me but the date is wrong," or "this is me and I'd rather not be visible to this branch" — all within the claim flow.

### 8.6 Duplicate resolution

Authority to merge follows the same precedence; a merge involving a living claimed person requires their consent. Every merge is reversible via an auditable merge log that retains the losing record's identifiers, relationships, and memories.

---

## 9. Privacy model

Privacy is a **primary product advantage**, not a settings page bolted on later.

### 9.1 Visibility levels

| Level | Who can see |
|---|---|
| **Only me** | The owner |
| **Selected relatives** | Named members only |
| **Immediate family** | Members within N degrees (defined, default 2) |
| **Entire family space** | All members of that space |
| **Anyone with the private link** | Holders of a revocable, expiring shared link |
| **Public** | Anyone (explicit opt-in only; off by default) |

### 9.2 Field-level control

Visibility is set **per field**, not per profile, for: exact birth date, phone number, address, personal documents, photographs, relationship disputes, medical information, details about minors, and any field an owner marks sensitive.

The UI shows, at the profile level, the *effective* result ("3 fields hidden from 4 relatives") rather than a matrix of toggles nobody configures.

### 9.3 Sensitive defaults

Hidden by default for **all living people**: exact birth date, phone number, address, personal documents, relationship disputes, medical information, details about minors, and any special safety consideration.

Deceased people default to richer visibility **within the family space** — historical preservation is the point — while contact details remain hidden.

### 9.4 Required capabilities

- **Hidden branches** — hide an entire subtree from a given member or group.
- **Private relationships** — an edge visible only to specified members (e.g. a custody arrangement).
- **Blocked users** — mutual invisibility; a blocked user cannot see your presence, fields, or invites.
- **Adoption and guardianship privacy** — the nature of the relationship is itself a protected field.
- **Separation from family members** — a person can remove themselves from a branch/space without destroying legitimate historical records (historical records become "unlinked/claimed-detached" with a suppression marker rather than being silently deleted).
- **Minors' data** — profiles for under-18s restricted to immediate family by default; no public visibility; guardian-controlled.
- **Permission-based photographs** — photos of a person require approval from that person (or their custodian), and tagging is opt-in for living people.
- **Account deletion without destroying the historical record** — delete the account and personal data, retain the structural relationship facts already contributed, with a clear in-product explanation of exactly what is kept and why.

**Core privacy stance:** *biological connection never grants access.* Being related is not consent.

### 9.5 Privacy UX requirements

- Every invitation link is scoped, revocable, and expiring.
- Before any invitation is sent, the sender sees **exactly what the invitee will see**.
- "Who can see this?" is answerable in one tap from any field.
- No indexable public surface exists unless a family space explicitly opts in.

---

## 10. Functional requirements

Requirements are numbered for traceability; detailed acceptance criteria live in [`MVP-FEATURES.md`](./MVP-FEATURES.md). Priority follows MoSCoW.

### 10.1 Account and identity (MVP)

| ID | Requirement | Priority |
|---|---|---|
| FR-1.1 | Sign up / in with email, phone (OTP), or social provider | Must |
| FR-1.2 | Basic personal profile: name, photo, birth date, birth place, living status | Must |
| FR-1.3 | Optional gender field, used only to generate relationship terms | Must |
| FR-1.4 | Alternative names / nicknames, searchable | Should |
| FR-1.5 | Locale and language preference; RTL support | Must |
| FR-1.6 | Account deletion and data export | Must |

### 10.2 Family space and tree creation (MVP)

| ID | Requirement | Priority |
|---|---|---|
| FR-2.1 | Create a family space seeded with the creator's own person record | Must |
| FR-2.2 | Add parents, spouses/partners, children, and siblings | Must |
| FR-2.3 | Add any relative **without** requiring their registration | Must |
| FR-2.4 | Multiple marriages, former spouses, blended families | Must |
| FR-2.5 | Adoptive, foster, guardian, and step relationships | Should |
| FR-2.6 | Guided onboarding (question sequence, not empty canvas) | Must |
| FR-2.7 | Belong to multiple family spaces; switch spaces | Must |

### 10.3 Interactive visualisation (MVP)

| ID | Requirement | Priority |
|---|---|---|
| FR-3.1 | Focus-centred rendering: selected person with N generations up/down | Must |
| FR-3.2 | Zoom, pan, expand/collapse branches | Must |
| FR-3.3 | Show direct relationships clearly (parent, spouse, child) | Must |
| FR-3.4 | Navigate up/down through generations from a person | Must |
| FR-3.5 | Compact vs. detailed view toggle | Should |
| FR-3.6 | Render performance bounded: no full-graph render; graceful degradation past ~2,000 visible nodes | Must |

### 10.4 Invitations and claiming (MVP)

| ID | Requirement | Priority |
|---|---|---|
| FR-4.1 | Shareable invite link to a family space | Must |
| FR-4.2 | Email invitation with relationship context and branch preview | Must |
| FR-4.3 | WhatsApp-friendly invitation (message text + preview link) | Must |
| FR-4.4 | **Claim an existing profile** rather than creating a duplicate | Must |
| FR-4.5 | Assign the invitee's expected relationship at invite time | Must |
| FR-4.6 | Invitation status tracking, resend, revoke, expiry | Must |
| FR-4.7 | Invite rate limits and opt-out | Must |

### 10.5 Collaborative editing and governance (MVP)

| ID | Requirement | Priority |
|---|---|---|
| FR-5.1 | Members propose additions and corrections | Must |
| FR-5.2 | Profile owners edit their own profiles | Must |
| FR-5.3 | Custodians manage profiles for dependants, elders, deceased | Must |
| FR-5.4 | Administrators approve sensitive changes | Must |
| FR-5.5 | Activity log for every major edit, with actor, before/after, timestamp | Must |
| FR-5.6 | Dispute state on conflicting values; both values retained with sources | Should |
| FR-5.7 | Comments/discussion on a proposed change | Should |
| FR-5.8 | Revert to a previous accepted value | Should |

### 10.6 Privacy (MVP)

| ID | Requirement | Priority |
|---|---|---|
| FR-6.1 | Living people private by default | Must |
| FR-6.2 | Field-level visibility control | Must |
| FR-6.3 | Hide dates, contact details, photos, or a whole branch | Must |
| FR-6.4 | No public discovery unless the family space explicitly enables it | Must |
| FR-6.5 | Request removal or separation from a tree, without destroying legitimate history | Must |
| FR-6.6 | Block a user; mutual invisibility | Should |
| FR-6.7 | Permission-based photo tagging for living people | Should |

### 10.7 Relationship calculator (MVP)

| ID | Requirement | Priority |
|---|---|---|
| FR-7.1 | Select any two visible people and compute their relationship | Must |
| FR-7.2 | Show the connection path and the nearest common ancestor(s) | Must |
| FR-7.3 | Provide a plain-language explanation | Must |
| FR-7.4 | "How am I related to…" shortcut from any profile | Must |
| FR-7.5 | Shareable result card (privacy-scrubbed) | Should |
| FR-7.6 | Culturally precise terms where locale supports them | Should (Phase 1.5) |

*Example output:* "Sara is your mother's brother's daughter, making her your first cousin." — with the path drawn on the tree.

### 10.8 Search and duplicate prevention (MVP)

| ID | Requirement | Priority |
|---|---|---|
| FR-8.1 | Search existing people before adding someone | Must |
| FR-8.2 | Detect similar names + overlapping relationships | Must |
| FR-8.3 | Suggest possible duplicates before and after creation | Must |
| FR-8.4 | Merge profiles with appropriate authorisation and reversible merge log | Must |
| FR-8.5 | Link the same person across family spaces | Could (post-MVP) |

### 10.9 Memories and the family archive (Phase 2)

| ID | Requirement | Priority |
|---|---|---|
| FR-9.1 | Photos attached to people, with caption, date, place, tagged people | Should (post-MVP) |
| FR-9.2 | Written stories with author attribution | Should |
| FR-9.3 | **Voice recordings** with upload and playback | Should |
| FR-9.4 | Documents (certificates, letters) with source attribution | Should |
| FR-9.5 | Family timeline across generations (births, marriages, migrations, deaths) | Should |
| FR-9.6 | Source/evidence attachment to factual claims | Should |
| FR-9.7 | Memory prompts ("ask your eldest relative about…") | Could |

### 10.10 Recurring value and notifications (post-MVP, retention-critical)

| ID | Requirement | Priority |
|---|---|---|
| FR-10.1 | Birthday and anniversary reminders (respecting privacy scope) | Should |
| FR-10.2 | New-relative notification when a branch is expanded | Should |
| FR-10.3 | "On this day" family memories | Could |
| FR-10.4 | Tree completeness / unanswered-question indicators | Could |
| FR-10.5 | Weekly or monthly family digest | Should |

### 10.11 Cultural relationship intelligence (differentiation)

| ID | Requirement | Priority |
|---|---|---|
| FR-11.1 | Distinguish paternal vs. maternal relatives | Should (Phase 1.5) |
| FR-11.2 | Distinguish elder vs. younger sibling of parent (e.g. *chacha* vs. *taya*; *mamu* vs. *khaloo*) | Should (Phase 1.5) |
| FR-11.3 | Locale-aware relationship terms in the user's language | Should (Phase 2) |
| FR-11.4 | User-editable term overrides per family space | Could |

*Rationale:* "uncle" is insufficient for most of the target market, and precise terms are a durable differentiator that a generic tree builder will not copy quickly.

### 10.12 AI family historian (Phase 3)

AI may **propose**, never silently rewrite family history. Candidate capabilities: speech-to-text of voice memories, entity extraction (names, dates) from stories, suggested relationships from narratives, translation into members' preferred languages, draft biography from approved facts, contradiction detection, photo metadata suggestions, and interview prompts. Every AI output enters the same proposal/approval pipeline as a human contribution and is labelled as machine-suggested.

### 10.13 Natural-language queries (Phase 3)

> "How am I related to Usman?" · "Which relatives lived in Lahore?" · "Show the descendants of my maternal grandfather."

Queries must run against the *requester's* permission scope and never reveal the existence of hidden people.

---

## 11. Non-functional requirements

### 11.1 Performance

- Onboarding to a recognisable tree: **under 2 minutes** for a typical user.
- Tree focus view interactive (pan/zoom at 60fps) in ≤1.5s on mid-range Android over 4G with up to ~250 visible nodes.
- Relationship calculation (path + LCA) returns in <300ms p95 for graphs up to 10k people per space.
- Duplicate search returns in <500ms p95.
- Photo upload tolerant of flaky mobile networks (resumable).

### 11.2 Scale

- 500 people typical family space; support 10,000 per space without architectural change.
- Generations deep: 10+.
- A person may belong to up to 20 family spaces.

### 11.3 Security and trust

- All private content encrypted in transit; at rest for sensitive fields (contact details, documents).
- Access checks enforced server-side at the *field* level, not only in the UI.
- Every privileged action audited immutably.
- Invite tokens: unguessable, scoped, expiring, revocable, single-purpose.
- Rate limiting on invitations, claims, and duplicate searches to prevent enumeration of people.
- Enumeration resistance: search results must not confirm the existence of hidden people.

### 11.4 Accessibility and internationalisation

- WCAG 2.1 AA: full keyboard navigation of the tree, screen-reader textual fallback for the visualisation (a list/outline view is a **requirement**, not an enhancement).
- RTL layout support from day one (Urdu, Arabic, Hebrew).
- All relationship terms localisable and gender-aware where the language requires it.
- Date entry tolerant of local formats; partial dates supported (year-only, month-year).
- Low-bandwidth mode: text-first tree, deferred media.

### 11.5 Browser support

Current and previous major versions of Chrome, Safari, Firefox, Edge; iOS Safari and Android Chrome. No IE. No native app in v1.

### 11.6 Data portability

Export a family space to a documented, open structure (GEDCOM-compatible subset plus media manifest) at any time. Data portability is a trust feature and a monetisable "premium archival export".

---

## 12. User experience

### 12.1 Onboarding

**Do not present an empty canvas.** Ask a short sequence:

1. What is your name?
2. Who are your parents?
3. Do you have siblings?
4. Do you have a spouse or partner?
5. Do you have children?
6. Which side of the family would you like to expand?
7. Who can help complete this branch? → **generate the first invitations here**

Within two minutes the user must see a recognisable family structure, and the session should end with an invitation action already prepared.

### 12.2 Main navigation

`Tree · People · Memories · Invitations · Activity · Settings`

### 12.3 Person profile

Contents (progressive): name and alternative names; photograph; relationship to the current user; birth and death information; biography; parents, siblings, spouses, children; places lived; photos and documents; stories and voice recordings; sources and verification status; visibility controls; claim/edit actions.

### 12.4 Interaction principles

- **Focus, don't render everything.** Always show a window around the selected person; expand on demand.
- **Explain every relationship.** Any edge can be tapped for "how are these two connected?"
- **Draft-first contribution.** Adding a relative is three fields, not a form.
- **Show the audience.** Before sharing anything, show who will see it.
- **Empty states teach.** Every empty area demonstrates the next best action.

---

## 13. Risks and mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| 1 | **Valuable only once** — tree built, never returns | Fatal to retention | Recurring value: birthdays/anniversaries, new-relative notifications, memory prompts, timelines, completeness indicators, "on this day" |
| 2 | **Invitation fatigue** — users spam relatives before value is shown | Growth stalls, brand damage | Context-rich invites with branch preview; rate limits; see-what-they-see preview; opt-out |
| 3 | **Family disputes** — contested names, marriages, parentage | Churn, emotional harm | Proposed edits, evidence, version history, disputed values retained (no forced single truth) |
| 4 | **Duplicate people** | Data pollution, irreversible trust loss | Relationship-aware duplicate detection **before** scale, not after; merge with authorization and reversibility |
| 5 | **Privacy concerns** | Users won't enter living relatives | Private-by-default, field-level controls, explicit invitations, transparent ownership, permission-based photos |
| 6 | **Visualisation complexity** | Unusable at scale | Focused rendering, branch expansion, list/outline fallback, bounded node counts |
| 7 | **Onboarding friction** | Low activation | Guided question flow; skip-tolerant; draft-first editing |
| 8 | **Modelling reality poorly** (half-siblings, adoption, remarriage) | Product feels wrong where it matters most | Graph model with typed, dated edges and derived relationships |
| 9 | **Trust failure on a private claim** (someone claims a profile that isn't theirs) | Severe | Verification + admin approval + dispute path + reversible merges |
| 10 | **Scope creep into genealogy research** | Loses focus, misses the loop | Explicit phase gates; MVP scope frozen in `MVP-FEATURES.md` |

---

## 14. Release phases

### Phase 1 — Structured family tree (MVP)

Profiles · Relationships · Interactive visualisation · Invitations · Profile claiming · Basic permissions · Duplicate detection · Relationship calculator.

**Exit criteria** (see `MVP-FEATURES.md` §6): a family space in which 3 relatives, in 3 different households, self-serve corrections and additions within 30 days, with zero duplicate persons created by those contributions.

### Phase 2 — Collaborative family archive

Photos · Stories · Voice recordings · Documents · Timeline · Edit proposals with evidence · Source attribution · Advanced privacy.

### Phase 3 — AI family historian

Transcription · Translation · Biography generation · Contradiction detection · Photo metadata suggestions · Interview prompts · Natural-language questions.

### Phase 4 — Family platform

Family events · Reunion planning · Announcements · Shared directories · Printed books and posters · Optional public historical collections · Institutional archives.

**Phase gates:** each phase begins only when the previous phase's primary metric holds for two consecutive months.

---

## 15. Monetisation

**Never charge for adding relatives** — that directly taxes the growth loop.

| Tier | Contents |
|---|---|
| **Free** | Build a tree, invite relatives, core relationship navigation, basic photos and stories, standard privacy controls |
| **Premium family plan** (per **family space**, sponsor-paid) | Larger media storage, audio and video memories, advanced permissions, document storage, AI transcription/translation, AI-assisted biographies, high-resolution exports, printable family books, advanced timelines, tree health and conflict reports |
| **One-time products** | Printed family tree posters, family history books, memorial pages, digitisation services, premium archival exports, reunion packages |

The paying unit is the **family space**, not the individual: one or more relatives sponsor the family archive while everyone else contributes. Sponsorship is visible and giftable ("sponsored by Ahmed for the Khan family") — the social framing matters as much as the pricing.

---

## 16. Open questions and decisions

| # | Question | Status | Owner |
|---|---|---|---|
| Q1 | What constitutes sufficient verification for a profile claim? | Open — needs trust/safety input | Trust & Safety |
| Q2 | Should a person be able to appear in two spaces without their consent (e.g. an estranged parent)? | Open — leaning "no for living adults" | Product + Legal |
| Q3 | What is the exact definition of "immediate family" (degree count)? | Provisional: 2 degrees within space | Product |
| Q4 | Do we allow a claimed person to block their own children from seeing them? | Open — emotionally and legally complex | Product + Legal |
| Q5 | Is cross-space person linking (same human, two spaces) MVP or Phase 2? | Provisional: **post-MVP** | Product |
| Q6 | Which languages ship at launch, and which relationship-term sets are required? | Open — candidate: English + Urdu | Product + Localisation |
| Q7 | Do we support partial dates (year only) in the data model from day one? | Decided: **yes** | Engineering |
| Q8 | Storage/CV pipeline for voice memories: build or buy? | Open | Engineering |
| Q9 | Is a public "historical collections" surface ever acceptable given the privacy stance? | Deferred to Phase 4 | Product |
| Q10 | How do we handle a family space with two irreconcilable administrator factions? | Open — proposal: fork with shared history | Product |

---

## 17. Glossary

| Term | Meaning |
|---|---|
| **Family space** | The shared container for a family's people, media, permissions, and activity |
| **Person** | A node in the family graph, registered or not |
| **Claim** | Linking a user account to an existing person record, granting self-ownership |
| **Custodian** | A trusted member who manages a profile on behalf of someone who cannot |
| **Derived relationship** | A relationship computed from stored edges (sibling, cousin, grandparent) rather than stored |
| **Protected field** | A field that only the owner or an authorised approver may change |
| **Proposed edit** | A suggested change awaiting approval, with evidence and status |
| **Duplicate candidate** | Two person records suspected of being the same human |
| **Focus view** | The bounded subtree rendered around a selected person |
| **LCA** | Lowest common ancestor(s) between two people, used in relationship calculation |

---

## 18. Appendix — worked example

**Graph facts (stored edges only):**

```
Abdul ─spouse─ Fatima
  │                 │
  ├─ parent of ─► Ahmed
  │                 │
  │            Ahmed ─spouse─ Zainab
  │                 │
  │                 ├─ parent of ─► Sana
  │                 └─ parent of ─► Bilal
  │
  └─ parent of ─► Nadeem
                    │
               Nadeem ─spouse─ Ayesha
                    │
                    └─ parent of ─► Sara
```

**Query:** "How am I related to Sara?" (requester = Bilal)

**Computed:**
- Path: Bilal → Ahmed (parent) → Abdul (parent) → Nadeem (child) → Sara (child).
- Nearest common ancestor: **Abdul** (1 generation from Nadeem, 2 from Bilal).
- Relationship: Ahmed and Nadeem are siblings; Nadeem's daughter Sara is Bilal's **first cousin**.
- Explanation: *"Sara is your father's brother's daughter — your first cousin (cousin-brother's daughter in Urdu: چچا زاد بہن)."*

Note there is **no stored "cousin" edge** — the entire answer is derived from four parent-child edges and one spouse edge.

---

*This document is a living specification. Changes must be recorded in §16 with rationale; scope changes to the MVP require an explicit decision note in `MVP-FEATURES.md` §7.*

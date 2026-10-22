# Fam Link

**Build your family tree together — and preserve the stories behind every connection.**

Fam Link is a private, collaborative web platform where families build and preserve their complete multigenerational family network. Each relative contributes the part they actually know: you add your parents, siblings, spouse, and children; your parents add theirs; cousins complete their branch; elders contribute stories, photographs, and the details nobody else remembers. The platform merges everyone's contributions into one connected family network, owned and maintained by the family itself.

> Every family carries stories that disappear when nobody records them.
> Build the family tree together, connect every generation, and preserve the people, memories, and history that made the family what it is.

---

## Why this exists

Family information is scattered across the memories of older relatives, family WhatsApp groups, physical photo albums, and separate branches of the family that rarely talk to each other. The result:

- Younger generations cannot name their extended relatives.
- Family history disappears when the people holding it pass away.
- Records are incomplete, contradictory, and duplicated across relatives.
- Photographs and stories survive without context — no names, dates, or relationships attached.
- No single person knows enough to build the whole tree, and existing tools assume one lone researcher.
- Conventional social networks cannot express "this is my stepfather, and this branch must not be visible to my mother's side."

Fam Link solves two linked problems:

1. **Relationship discovery** — who belongs to my family, and how is everyone connected?
2. **Family preservation** — what knowledge, memories, and history should survive into the next generation?

## What makes it different

| Most family-history products | Fam Link |
|---|---|
| Built for one researcher working alone | Built for many living relatives contributing in parallel |
| Emphasises ancestors and historical records | Emphasises living extended families *and* the archive |
| A tree of names | A graph of typed, dated, sourced relationships |
| Privacy is a settings page | Privacy is the product: private by default, controlled per field |
| "Uncle" | Paternal vs. maternal, elder vs. younger brother of your father — precise kinship terms |
| Last write wins | Proposed edits, evidence, disputes, and full history |
| Registered users only | Add relatives who never sign up — they can claim their profile later |

**Positioning:** a collaborative family tree, a private family network, a generational archive, a relationship discovery engine, and a family history knowledge base — *not* an ancestry or DNA research tool.

## The core loop

```
Create a family tree
   → add the relatives you know (no registration required)
   → the platform generates contextual invitations
   → relatives claim their profiles and correct their details
   → they add their side of the family
   → new relatives, new invitations, a richer tree
```

The invitation carries the relationship, not a marketing pitch:

> **Ahmed added you as his maternal uncle in the Khan family tree.**
> Claim your profile and help complete your branch.

The relationship itself is the reason to join. That is the growth model.

## Who it's for (first)

Large, geographically distributed South Asian families documenting extended relationships and preserving family history — families planning reunions, diaspora families, community elders, and parents teaching children who their relatives are.

**Beachhead use case:** *Invite your relatives and map your extended family before the next family reunion.*

## Documentation

| Document | What's in it |
|---|---|
| **[PRD](./docs/PRD.md)** | Vision, problem, personas, product model, authority and privacy models, functional and non-functional requirements, metrics, risks, phases, monetisation |
| **[MVP Feature List](./docs/MVP-FEATURES.md)** | Phase 1 scope: 9 epics, MoSCoW priorities, acceptance criteria, out-of-scope list, exit criteria, release slices |

Start with the PRD if you want to understand *why*; start with the MVP list if you want to know *what to build next*.

## Design principles

1. **Contribution beats completeness.** A partly-filled tree with five contributors is worth more than a perfect tree with one author.
2. **The relationship is the invitation.** People join because of who they are in the tree.
3. **Private by default.** Every living person starts private; access is granted, never assumed.
4. **Never silently overwrite.** Disagreement is data, not an error to erase.
5. **Propose, never impose.** Machines and most humans suggest; owners and administrators decide.
6. **The graph is the truth; the UI is a view.** The interface says "tree"; the system stores a graph.
7. **Two minutes to recognition.** A new user sees a family structure they recognise before being asked to invest effort.
8. **Cultural fluency is a feature, not a translation.**

## Key concepts

| Concept | Meaning |
|---|---|
| **Person** | A node in the family graph — living or deceased, registered or not, claimed or unclaimed |
| **User account** | A registered person. Not every person in a tree needs one |
| **Relationship** | A typed, usually directional edge; siblings, cousins, and grandparents are *derived*, never stored |
| **Family space** | The shared container for a family's people, media, permissions, and history — and the unit of billing and privacy |
| **Claim** | Linking a user account to an existing person record, transferring self-ownership |
| **Custodian** | A trusted relative who manages a profile for a child, elder, deceased person, or non-user |

Relationships are stored as: biological/adoptive/foster parent, guardian, spouse, former spouse, and partner. Everything else — half-siblings, step-relations, aunts, uncles, cousins, in-laws, and ancestors — is computed from those edges. This is what keeps the graph consistent when someone corrects a parentage.

## The hard problem

Drawing nodes and lines is easy. Deciding **who may create, edit, approve, merge, hide, or delete information about another person** is not.

Consider: you create a profile for your uncle, a cousin edits his birth date, the uncle registers and claims the profile, two administrators disagree, he wants to be hidden from one branch of the family, and he already exists in another tree.

Fam Link answers this with an explicit authority hierarchy (profile owner → custodian → family administrator → contributor → viewer), protected fields, and a change model that stores previous value, proposed value, contributor, evidence, timestamp, and approval status for every important edit.

## Repository status

**Working demo.** Domain, API, and web client are implemented and runnable, with a synthetic family.
No real family data belongs in this repository.

### Run it

```bash
npm install
npm run dev        # API on :8787, web on :5173 (proxies /api)
npm test           # 158 tests
npm run typecheck
npm run build      # typecheck + production build of the web client
```

Open the web app and pick a demo account. Each persona sees a different amount of the same family,
because privacy is enforced per field on the server.

| Demo account | Role | What they see |
|---|---|---|
| Ayesha Khan | Family administrator | Everything; resolves proposals, disputes, duplicates |
| Bilal Khan | Contributor (claimed) | His branch, his own private fields, changes awaiting approval |
| Sadia Khan | Contributor | Her branch; other living relatives' birth dates withheld |
| Ahmed Khan | Contributor (eldest generation) | His own profile and descendants |
| Nadeem Khan | Unclaimed → can claim via invitation | The invite flow end to end |
| Seher Khan | Unclaimed | Used to exercise claiming a second branch |

Two things worth trying:

1. **Relationship** → Bilal and Sara. The answer names the path ("your father's brother's
   daughter") and the Urdu term (چچا زاد).
2. **Invitations** → open the pending Nadeem invitation → claim it. The profile is *claimed*, not
   duplicated; then correct a protected field and watch a competing claim become a proposal in
   **Activity**.

### What exists

```
packages/domain/     pure logic — graph, derivation, calculator, privacy, authority,
                     duplicates, proposals/disputes, revert planning
apps/api/            JSON-backed repository, seed family, HTTP API, privacy projection,
                     derived notifications
apps/web/            React + Vite client: tree, people, calculator, invitations, activity,
                     privacy settings, invite/claim page, onboarding, English/Urdu shell
docs/                PRD, MVP scope, ADRs, glossary
PROGRESS.md          step-by-step build log, checklist, decisions and deviations
```

Implemented: family graph with derived siblings and cycle-safe traversal; focus-window tree with
zoom, pan, depth controls, compact/detailed modes, in-branch search, and an accessible outline;
people search across transliterations and scripts; profile editing that routes protected fields into
proposals; claiming; invitations whose copy carries the relationship; relationship calculator with
path, common ancestor and Urdu kinship terms; explainable duplicate detection with merge; disputed
values retained with both claims; precise revert; derived notification feed; field-level privacy
authoring; hidden branches; minors, blocked users, separation, abuse reporting, scoped export and
account deletion; guided onboarding; English/Urdu shell with RTL.

Duplicates are reviewed with an explanation of *why* each pair was suggested, merges can be undone,
and the People screen includes a tree-health report of the things that actually make a tree
unreliable (dates that cannot be true, records with no links, disputed values). The chart is
keyboard-operable: arrow keys move to a parent, child or partner, and the rules behind that are a
pure, tested module rather than inline DOM logic.

Invitations are delivered through a durable outbox with idempotent sends: the message is recorded
before it is attempted, a repeated tap returns the original message rather than a second one, and an
administrator can see what was sent and when. The transport in this build writes to the server log —
there is no mail provider connected, and the UI says so rather than claiming a delivery happened.

**Deliberately not built yet** (see `PROGRESS.md` §8): real authentication and a mail/WhatsApp provider,
memories and voice recordings (Phase 2), notification preferences, full localisation of every
screen, per-node branch collapsing, keyboard-first tree navigation, and a cross-space switcher.

### Where the docs are

- [`AGENTS.md`](./AGENTS.md) — build commands, conventions, non-negotiable domain rules
- [`GLOSSARY.md`](./GLOSSARY.md) — canonical vocabulary
- [`PROGRESS.md`](./PROGRESS.md) — what is built, what is next, and what changed vs. plan
- [`docs/adr/`](./docs/adr) — binding architectural decisions

### Constraints carried into the code

- **The domain model is a graph, not a tree.** Cycle-safe traversal, multi-path relationships, and
  multiple lowest common ancestors are handled in `packages/domain`.
- **Relationship derivation lives in the domain.** The chart and the calculator read one graph.
- **Privacy is a server-side projection.** A restricted field is absent from the API response, not
  hidden with CSS, and a hidden person returns the same 404 as someone who never existed.
- **Disagreement is data.** Conflicting claims are both retained; decisions supersede rather than
  erase, and reverts are new changes in an append-only log.

## Roadmap

| Phase | Focus |
|---|---|
| **1 — Structured family tree** *(MVP)* | Profiles, relationships, interactive visualisation, invitations, profile claiming, basic permissions, duplicate detection, relationship calculator |
| **2 — Collaborative family archive** | Photos, stories, voice recordings, documents, timeline, edit proposals with evidence, advanced privacy |
| **3 — AI family historian** | Transcription, translation, biography drafts, contradiction detection, interview prompts, natural-language questions |
| **4 — Family platform** | Family events, reunion planning, printed books and posters, institutional archives |

Each phase begins only when the previous phase's primary metric holds for two consecutive months.

## The one metric that matters

> **Percentage of family spaces with at least three contributing relatives within 30 days.**

That single number separates a collaborative family network from a one-person diagram. Every scope decision in this repository is made in service of it.

## Contributing

- Read the [PRD](./docs/PRD.md) and the [MVP Feature List](./docs/MVP-FEATURES.md) before proposing scope.
- Anything not in the MVP list is out of scope for Phase 1 — including things that feel obviously necessary. Challenge the scope in a discussion rather than in a pull request.
- Privacy, authority, and graph-model changes require an ADR.
- Never commit real family data, personal information, or production credentials to this repository. Use synthetic families in fixtures and tests.

## Licence

To be determined.

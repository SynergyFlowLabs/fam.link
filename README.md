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

**Working demo.** The domain, API, and web client are implemented and runnable. The family in the
demo is synthetic — no real family data belongs in this repository.

### Run it

```bash
npm install
npm run dev        # API on :8787, web on :5173 (proxies /api)
npm test           # 81 tests across domain, API, and layout
npm run typecheck
```

Open the web app and pick a demo account. Each persona sees a different amount of the same family,
because privacy is enforced per field on the server:

| Demo account | Role | What they see |
|---|---|---|
| Ayesha Khan | Family administrator | Everything, resolves proposals and duplicates |
| Bilal Khan | Contributor (has claimed his own profile) | His branch, his own private fields, proposals awaiting approval |
| Sadia Khan | Contributor | Her branch; other living relatives' birth dates are withheld |
| Ahmed Khan | Contributor (eldest generation) | His own profile and descendants |

Try: open **Relationship**, pick Bilal and Sara, and read the answer. Then open **Invitations** and
open the pending invitation to Nadeem — the link shows only first names and the relationship, and
accepting it *claims* the existing person rather than creating a second one.

### What exists

```
packages/domain/     pure domain logic — graph, derivation, calculator, privacy, authority, duplicates
apps/api/            JSON-backed repository, seed family, HTTP API, privacy projection per request
apps/web/            React + Vite client: tree, people, calculator, invitations, activity, invite page
docs/                PRD, MVP scope, ADRs
PROGRESS.md          step-by-step build log and feature checklist
```

Implemented: family graph with derived siblings; focus-window tree with zoom, pan, and generation
expansion; an accessible outline fallback; people search across names and scripts; profile editing
that routes protected fields into proposals; claiming; invitations with relationship-carrying copy;
relationship calculator with path, common ancestor, and Urdu kinship terms; duplicate detection with
explainable signals and merge; activity log; field-level privacy; minors, blocked users, separation,
and export.

Not implemented yet, and deliberately visible as gaps: real sign-in (demo personas stand in),
email/WhatsApp *delivery* (links are generated, not sent), memories and voice recordings (Phase 2),
notifications, and multi-space switching in the UI.

### Where the docs are

- [`AGENTS.md`](./AGENTS.md) — build commands, conventions, non-negotiable domain rules
- [`GLOSSARY.md`](./GLOSSARY.md) — canonical vocabulary
- [`PROGRESS.md`](./PROGRESS.md) — what is built, what is next, and what changed vs. plan
- [`docs/adr/`](./docs/adr) — binding architectural decisions

### Architectural constraints carried into code

- **The domain model is a graph, not a tree.** Cycle-safe traversals, multi-path relationships, and
  multiple lowest common ancestors are handled in `packages/domain`.
- **Relationship derivation lives in the domain.** The tree view and the calculator read the same
  graph; nothing about kinship is computed in a component.
- **Privacy is a server-side projection.** A restricted field is absent from the API response, not
  hidden by CSS.

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

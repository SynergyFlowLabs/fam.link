# fam.link — Product Brief

**Version 0.1 · October 2026 · Status: refined idea, pre-build**

> **One-liner:** fam.link is a free, open family-memory app — build your family tree as deep as you know, then hang the photos, voices, and stories on every branch. Solo first, with family invited in when you're ready.

**Tagline candidates**

- *Your family, remembered.*
- *The tree is the map. The stories are the territory.*
- *Keep the link.*

---

## 1. Where the idea started — and where it's refined to

**Original idea:** *"A tool where anyone can build their whole family tree to as much level as they know."*

That framing makes this a **storage problem**. The refinement: it's a **memory problem**. A 12-generation tree of names and dates is a database; a 4-generation tree with voices, photos, and stories is a treasure. The tree is the *skeleton* — what makes people care, share, and contribute is the flesh.

**Six refinement moves:**

1. **Reframe the job.** From "store a tree" → "capture what your family knows before it's lost." Depth stays core, but stories are the hook and the reason relatives accept invites.
2. **Make "unknown" a first-class citizen.** "As much level as they know" includes *knowing someone existed without knowing details*. Half-filled ancestor placeholders, fuzzy dates ("c. 1947", "before Partition", "early 1900s"), and fuzzy places must be easy — not validation errors.
3. **A graph, not a tree.** Cousin marriages (pedigree collapse), remarriages, half-siblings, adoption. The data model must be a person-centric DAG where one human is always exactly one node — never duplicated.
4. **Solo-first, family-later collaboration.** Knowledge is distributed across a family; the builder curates, relatives contribute when invited. No one should be forced to collaborate on day one.
5. **No lock-in as strategy.** For a free community tool, trust is the moat: unlimited tree size, GEDCOM + JSON export forever, open-source code. This is the deliberate anti-MyHeritage move.
6. **Global by design.** Names in multiple scripts, non-Gregorian dates (Hijri, Vikram Samvat), places that changed names, patronymic naming. Most tools bolt this on later and handle it badly.

**Direction (from your decisions):** global audience · hybrid collaboration · free community tool · story-first differentiator.

---

## 2. The problem worth solving

**For users:**

- The people who hold a family's history are mortal. Knowledge disappears at every funeral, migration, and scattered household.
- Existing tools make capture feel like clerical work: rigid forms, exact-date demands, and an upgrade prompt every five minutes.
- Families' history sits in silos (one cousin's Ancestry account, another's WhatsApp photos, a grandmother's memory).

**Market evidence (why there's room):**

| Player | What it actually is | The gap |
| --- | --- | --- |
| Ancestry | Records-subscription business (~$20–35/mo); trees are bait for subscriptions | Paywalled; Western-records-centric |
| MyHeritage | Freemium; free Basic tier capped at **250 people / 500 MB** | Cramped free tier, upsell pressure, siloed data |
| FamilySearch | Free nonprofit records archive + **one shared global tree** | Anyone can edit your ancestors; research-oriented, not memory-oriented; no fully private trees |
| WikiTree | Free community-governed shared tree | Text-first, dated UX, genealogist culture |
| Geni | "World tree" owned by MyHeritage, freemium | Merge conflicts, paywalled matches |
| Gramps | Open-source desktop powerhouse | Desktop-only, power-user UX |

Every major player is either a **records business** or a **research archive**. Nobody leads with *memory capture* — free, unlimited, private by default, and story-first. That's fam.link's lane. (And it's complementary, not competitive: serious researchers can stay on Ancestry/FamilySearch and treat fam.link as the layer their whole family can actually use.)

---

## 3. Who it's for (personas)

| Persona | Who | What they need |
| --- | --- | --- |
| **The Rememberer** (primary builder) | 30–60, collects photos at gatherings, worries the elders' knowledge dies with them | Fast solo capture, beautiful result, no paywall anxiety |
| **The Knowledge Holder** | 60+, holds generations of lore, will *not* create an account | Dead-simple contribution: voice notes, or "answer one question" links the Rememberer sends them |
| **The Curious Relative** | Gets a share link at a wedding or funeral | Gorgeous read-only tree + timeline; can add a memory in 30 seconds if moved to |
| **The Reconnector** | Diaspora, hunting village-of-origin and migration stories | Depth, fuzzy places, multilingual names; later, community discovery |

Persona 2 is the strategic one: the app must be great *at capturing someone else's knowledge*, not just at the builder's data entry.

---

## 4. Product principles

1. **The tree is the map, the stories are the territory.** Every feature decision asks: does this help capture or surface memory?
2. **Free and unlimited.** A family's history is not a premium feature. No person-count caps, no paywalled exports.
3. **Your data is yours.** Export (GEDCOM + JSON + media archive) always works, deletion means deletion, no ads, no data selling, no model training on private trees.
4. **Solo first, family later.** Never force collaboration; make inviting family the natural next step once the tree is worth sharing.
5. **Dignity over engagement.** No streaks, no leaderboards, no nagging notifications. Memory capture is episodic and sacred — the product should respect that.
6. **Global by design.** Multiple scripts per name, fuzzy dates, alternative calendars, renamed places.
7. **Progressive depth.** Great at a 10-person tree and at a 10,000-person tree — the UI expands in sophistication as the tree does.

---

## 5. The core experience

### 5.1 The Canvas — building the tree

- **Person-centric graph.** Click any person → add parents, spouse(s), children, siblings. One human = one node, even when cousin marriages loop branches back (the DAG problem most tools fumble).
- **Quick-add chains.** "Add Ahmed → his father → his father → his father" without leaving the keyboard. Depth is the original insight; make going deep feel like flowing downhill.
- **Unknown placeholders.** An ancestor node can exist with nothing but "born somewhere near Multan, ~1900." Known-unknowns are progress, not errors.
- **Fuzzy everything.** Dates: "c. 1947", "before 1965", "Ramadan 1978 (Hijri 1398)". Places: free text with optional geocode, honoring historical place names.
- **Navigating depth.** Collapsible branches, focus-on-person mode, search, and a gentle stat: "You've captured 7 generations."

### 5.2 The Story Layer — the differentiator

- **Person profiles** carry a facts sidebar *and* a memories feed.
- **Memory types:** text anecdotes (date-stamped "moments"), photos with tagged people, voice recordings, document scans.
- **Story prompts.** Gentle interview questions per person ("What do you remember about Nana's kitchen?"). Sendable as **"ask a relative" links** — the Knowledge Holder answers one question without an account. This is how knowledge actually gets captured.
- **Family timeline.** A vertical scroll of all memories across the tree, filterable by branch or decade — the "family memoir" view.
- **Print & keep.** Clean print styles now; a generated family book (PDF) later.

### 5.3 Sharing & collaboration

- **Share links:** read-only, watermarked, living people auto-redacted, revocable.
- **Invites with roles:** viewer / commenter / editor. Contributors see "their" branch highlighted; the owner curates.
- **Contribution etiquette built in:** suggested changes for non-owners on contested facts, with a light "how do you know?" source field — enough credibility machinery without becoming RootsMagic.

---

## 6. MVP scope

**Must have (v0 — the believable promise):**

- Accounts (email magic link; phone OTP soon after — global-south friendly)
- Tree CRUD on a pannable/zoomable canvas, quick-add chains, unknown placeholders, fuzzy dates
- Person profile with facts and notes
- Memories v0: text anecdotes + photos on any person
- Read-only share link with living-person redaction
- **GEDCOM import (as a review workflow, not blind upload) + GEDCOM export + JSON export**
- Real account/tree deletion

**Should have (v1.x):** voice memories · story prompts + ask-a-relative links · timeline view · invite roles · i18n with RTL (Urdu/Arabic/Hebrew) · print-friendly views · duplicate detection.

**Explicitly cut for now (non-goals):** records search · hints · DNA · auto-matching · public/shared world tree · native apps · AI features · family book printing · any paid tier. Records and DNA are partnership-heavy businesses — fam.link is the memory layer, not an archive.

---

## 7. Data & technical notes (light, pre-build)

- **Model:** `persons`, `unions` (marriages/partnerships), `parent_child` edges, `events` (birth/death/marriage with fuzzy date ranges), `memories`, `media`. The graph is a **DAG** — pedigree collapse must resolve to existing nodes, never duplicates.
- **GEDCOM reality:** the standard is old and lossy (poor media and source handling, ambiguous spec). Treat GEDCOM as an *interchange boundary*, keep the internal model richer, and make import a guided review.
- **Suggested stack:** Next.js + TypeScript · Postgres (Supabase/Neon) · S3-compatible media storage · React Flow or custom SVG with a layered DAG layout (d3-dag/ELK) · server-side GEDCOM parsing. i18n + RTL from early on.
- **Scale:** virtualized rendering and branch collapsing so a 10k-person tree stays smooth.
- **Open source** the app (suggest AGPL-3.0: forks must stay open, cloud rehosting can't go proprietary).

---

## 8. Privacy & trust model

- Trees are **private by default**; the owner controls visibility per invite/link.
- **Living vs deceased:** living persons' details are visible only to permitted viewers; deceased can be shared more freely.
- No ads, no data selling, no training on private content — ever, in writing.
- Export anytime; deletion is real and complete.
- When the community layer arrives (public profiles), it applies **only to deceased persons** and only with owner approval — no FamilySearch-style "anyone can edit grandma" surprises.

---

## 9. Sustainability — free forever, how?

A community tool that later adds a paywall betrays its early adopters; "free now, pay later" is off the table.

- **Open source (AGPL)** + public roadmap: contributions and trust compound.
- **Donations** (Open Collective / GitHub Sponsors) against lean infra: Postgres + object storage + serverless is cheap for text-first trees; media is the cost driver — compress aggressively, cap sizes, and let donors cover it.
- Later, optional **pass-through printing** (family books at cost, no margin) — value without a paywall.
- Volunteer-maintained, docs-first, so it survives founder burnout.

---

## 10. Risks & open questions

| Risk | Mitigation |
| --- | --- |
| Tree-building feels like a chore halfway | Quick wins ("add 3 relatives in 2 minutes"), ceremony-aware moments (weddings, funerals, Eid/Christmas reunions) |
| Media storage costs | Compression, caps, donation-funded, text-first design |
| GEDCOM import messes | Import = guided review workflow, never a blind overwrite |
| Rendering huge trees | Collapsed-by-default branches, virtualization |
| Trust (the whole product) | Export-first design, open code, plain-language privacy policy |
| Governance if community grows | License + moderation policy decided *early*, even if unused for a year |

**Open questions:** phone-OTP auth priority? launch languages beyond English? how public can deceased profiles ever get? should facts carry "unverified/verified" states at v0 or later?

---

## 11. What success looks like (community-tool metrics, not growth-at-all-costs)

- **Activation:** % of new users who add ≥ 10 people in their first session
- **Depth:** median generations captured per tree
- **Story attach rate:** memories per 10 people (the differentiator's metric)
- **Family pull:** invite acceptance rate; % of trees with ≥ 2 contributors
- **Trust:** export usage (counter-intuitively, high export = high trust = high retention)
- **Durability:** % of trees still being edited at 90 days

---

## 12. Roadmap sketch

| Phase | Focus | Rough shape |
| --- | --- | --- |
| **0 — Prototype** | Prove the canvas | Auth, person CRUD, quick-add chains, fuzzy dates, pan/zoom canvas |
| **1 — MVP** | The believable promise | Memories (text + photo), share links, invites + roles, GEDCOM in/out, JSON export |
| **2 — Story depth** | The differentiator | Voice memories, prompts + ask-a-relative links, timeline view, i18n/RTL, print styles |
| **3 — Community layer** | Scale the mission | Public deceased profiles with governance, API, family book generation, contributor program |

---

## Appendix — sources & further reading

- Free-tier and tool comparison landscape: [lineage.tools comparison](https://lineage.tools/blog/best-free-family-tree-builders), [kleiobase comparison](https://kleiobase.com/blog/best-genealogy-software-2026)
- Shared-tree editing concerns: [r/Genealogy PSA on community trees](https://www.reddit.com/r/Genealogy/comments/1vcgv6p/psa_community_trees_like_familysearch_and/)
- GEDCOM limitations: [r/Genealogy: "Why do we still use GEDCOM?"](https://www.reddit.com/r/Genealogy/comments/1em1l4f/why_do_we_still_use_gedcom/), [GEDCOM on Wikipedia](https://en.wikipedia.org/wiki/GEDCOM)
- Usage surveys: [GenomeLink survey (Ancestry 83% usage)](https://genomelink.io/blog/best-app-for-making-a-family-tree)
- Comparable community projects: [WikiTree](https://www.wikitree.com), [Gramps](https://gramps-project.org), [webtrees](https://www.webtrees.net)

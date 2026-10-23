# fam.link — Build Progress

Living tracker for the fam.link implementation. Updated and pushed after every step.
Product spec: `docs/product-brief.md` · Agent conventions: `AGENTS.md`

**Legend:** ✅ done · 🚧 in progress · ⬜ not started

---

## Current status

**Phase:** Improvement batch complete (Phases 1–4 of the roadmap shipped) — deployed
**Working app:** yes — **https://myfamlink.vercel.app** (demo mode), demo login demo@fam.link / demo1234
**License:** AGPL-3.0-only (`LICENSE`)
**Last update:** 2026-10-23

## Phase 0 — Foundations

| # | Step | Status |
|---|------|--------|
| 0.1 | Product brief (idea refinement) | ✅ `docs/product-brief.md` |
| 0.2 | Repo hygiene: AGENTS.md, PROGRESS.md, initial push | ✅ |
| 0.3 | Install relevant skills from skills.sh | ⬜ |
| 0.4 | Scaffold Next.js + TypeScript + Tailwind app, build passes | ✅ |
| 0.5 | Data layer: Drizzle schema (users, sessions, trees, persons, unions, parent_child, memories) | ✅ |
| 0.6 | Auth: signup / signin / signout, scrypt + session cookies | ✅ |
| 0.7 | Landing page + dashboard (tree list, create/delete tree) | ✅ |

## Phase 1 — MVP (the believable promise)

| # | Step | Status |
|---|------|--------|
| 1.1 | Tree canvas: SVG renderer, pan/zoom, bespoke family layout engine | ✅ |
| 1.2 | Quick-add: +father / +mother / +spouse / +child from any node, keyboard-friendly | ✅ |
| 1.3 | Unknown placeholders + fuzzy dates/places in all capture forms | ✅ |
| 1.4 | Person profile page: facts, edit, relationships | ✅ |
| 1.5 | Story layer v0: text memories on any person | ✅ |
| 1.6 | Focus person (re-root the tree), generation stats | ✅ |
| 1.7 | Photo memories (upload + display on profile) | ✅ |
| 1.8 | Read-only share links with living-person redaction | ✅ |
| 1.9 | GEDCOM export | ✅ |
| 1.10 | GEDCOM import (review workflow) | ✅ `da6b361` — stage → preview → confirm; 32 GEDCOM tests incl. round-trip |
| 1.11 | JSON export | ✅ |
| 1.12 | Invite collaborators with roles | ✅ |
| 1.13 | Vercel deployment (auto-migrate, auto-seed, /tmp data dir) | ✅ |
| 1.14 | Production hardening: stateless sessions + deterministic seed IDs | ✅ |

## Phase 2 — Story depth

| # | Step | Status |
|---|------|--------|
| 2.1 | Voice memories | ✅ #36 (record + playback, transcription-ready) |
| 2.2 | Story prompts + ask-a-relative links | ✅ #38 + #35 |
| 2.3 | Family timeline view | ✅ #28 (memoir/timeline) |
| 2.4 | i18n + RTL | ⬜ |
| 2.5 | Print-friendly views | ✅ #39 (book view + typeset PDF) |
| 2.6 | Branch collapse + huge-tree virtualization | ✅ #27 (+ #26 alternate layouts, #30 minimap/keyboard/density) |

## Phase 3 — Collaboration & community

| # | Step | Status |
|---|------|--------|
| 3.1 | Public deceased profiles + explore + community suggestions | ✅ (Quraysh tree, /explore, suggestion queue) |
| 3.2 | Activity feed & history with undo | ✅ #31 |
| 3.3 | Comment threads on person & memoir | ✅ #32 |
| 3.4 | Private vs shared fields — per-field visibility | ✅ #33 |
| 3.5 | Role refinement — branch-level editor & moderation queue | ✅ #34 |
| 3.6 | Ask-a-relative links (no-account memory capture) | ✅ #35 |
| 3.7 | Public API | ⬜ |
| 3.8 | Merge governance | ⬜ |

## Phase 4 — Storytelling & media (roadmap P4.x — shipped)

| # | Step | Status |
|---|------|--------|
| 4.1 | Voice memories — recording (+ transcription-ready) | ✅ #36 |
| 4.2 | Media gallery & source management | ✅ #37 |
| 4.3 | Story prompts & narrative walkthrough | ✅ #38 |
| 4.4 | Print-friendly family book (PDF) | ✅ #39 |
| 4.5 | Relationship graph analytics & insights | ✅ #40 (local-only, opt-out) |

## Phase 5 — Advanced & analytics (future)

Privacy-first groundwork shipped with #40 (pure local analytics, opt-in panel). Remaining, all explicitly future: historical context overlay (needs a curated source), smart memory-mining suggestions (needs data depth), i18n + RTL (2.4), public API, merge governance, persistent blob storage for uploads. Non-goals stand: no DNA, no record hints, no auto-matching, no ads, no model training on private content.

---

## Changelog

- **2026-10-23 — Improvement batch complete (issues #19, #22–#41 · PRs #21, #43–#58):** the full roadmap issue set shipped, merged, and verified on production (every PR merged → Vercel READY/PROMOTED; issue auto-closed via `Closes #N`). **Profile depth:** structured life events + source citations (#22), labels & custom fields (#17), faceted search & relationship path (#23), visual relationship semantics (#24). **Privacy & sharing:** branch-scoped invites/share links (#25), per-field private/shared visibility (#33), role refinement with branch editors & moderation queue (#34), ask-a-relative no-account capture links (#35). **Canvas:** alternate layouts — pedigree/descendant/fan/radial/list (#26), branch collapse + virtualization for huge trees (#27), minimap/keyboard nav/density + compact mode (#30), map view with geocoded place history & migration paths (#29). **Story layer:** timeline/memoir view (#28), comment threads (#32), activity feed with 5-min undo (#31), voice memories with in-browser recording & playback (#36), media gallery + source management (#37), curated story prompts + shareable narrative walkthrough (#38). **Keepsake & insight:** the family book — print-optimized HTML view + typeset PDF via @react-pdf (Fraunces vendored; fontkit ESM subsetter bug pinned to CJS; living relatives redact/include/omit, verified by extracted PDF text) (#39) — and local-only, opt-out insights (branch story coverage, generation gaps, unremembered people) (#40). Docs: README feature list + this tracker brought current (#41 PR). 301 unit tests; tsc/lint/build green throughout.
- **2026-10-22 — Step 0.1:** Refined the raw idea into a full product brief (positioning, personas, MVP scope, non-goals). `docs/product-brief.md`
- **2026-10-22 — Step 0.2:** Added `AGENTS.md` (agent conventions per agents.md standard) and this progress tracker. First push to `arena/fba2a30e-fam-link`.

## Next up

Remaining backlog (all tracked, none blocking):

1. **i18n + RTL** (2.4) — global-by-design needs Urdu/Arabic script direction
2. **Persistent uploads** — blob storage so media survives cold starts (DB rows already survive)
3. **Hosted Postgres** — one `DATABASE_URL` env var flip; schema + migrations already dual-ported
4. **Historical context overlay** (#40 follow-up) — needs a curated public-domain source
5. **Public API + merge governance** (Phase 3 tail) — after data depth grows

(Correction 2026-10-23: GEDCOM import was already shipped — `da6b361`, MVP 1.10, guided review workflow with round-trip tests; the tracker had it marked ⬜ in error.)

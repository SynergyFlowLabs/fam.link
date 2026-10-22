# fam.link — Build Progress

Living tracker for the fam.link implementation. Updated and pushed after every step.
Product spec: `docs/product-brief.md` · Agent conventions: `AGENTS.md`

**Legend:** ✅ done · 🚧 in progress · ⬜ not started

---

## Current status

**Phase:** Phase 1 (MVP) — canvas + quick-add + stories live
**Working app:** yes — dev preview on :3000, demo login demo@fam.link / demo1234
**Last update:** 2026-10-22

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
| 1.7 | Photo memories (upload + display on profile) | ⬜ |
| 1.8 | Read-only share links with living-person redaction | ⬜ |
| 1.9 | GEDCOM export | ⬜ |
| 1.10 | GEDCOM import (review workflow) | ⬜ |
| 1.11 | JSON export | ⬜ |
| 1.12 | Invite collaborators with roles | ⬜ |

## Phase 2 — Story depth

| # | Step | Status |
|---|------|--------|
| 2.1 | Voice memories | ⬜ |
| 2.2 | Story prompts + ask-a-relative links | ⬜ |
| 2.3 | Family timeline view | ⬜ |
| 2.4 | i18n + RTL | ⬜ |
| 2.5 | Print-friendly views | ⬜ |
| 2.6 | Branch collapse + huge-tree virtualization | ⬜ |

## Phase 3 — Community layer

Public deceased profiles, API, family book generation, governance. Not started.

---

## Changelog

- **2026-10-22 — Step 0.1:** Refined the raw idea into a full product brief (positioning, personas, MVP scope, non-goals). `docs/product-brief.md`
- **2026-10-22 — Step 0.2:** Added `AGENTS.md` (agent conventions per agents.md standard) and this progress tracker. First push to `arena/fba2a30e-fam-link`.

## Next up

- 0.3 install skills → 0.4 scaffold app → 0.5 data layer → 0.6 auth → 0.7 landing + dashboard
- **2026-10-22 — Step 0.4:** Scaffolded Next.js 16 (App Router, Turbopack) + TS + Tailwind v4. Self-hosted Fraunces via @fontsource (no Google Fonts network dependency). Design tokens: evergreen/aged-paper/heirloom-gold palette in `globals.css`. Prod build passes.
- **2026-10-22 — Step 0.5:** Drizzle schema + SQLite (WAL, FKs on) for users, sessions, trees, persons, unions, parent_child, media, memories. DAG-safe: children attach to unions, partnerB nullable, fuzzy date text columns, unknown-name persons legal. `data/` gitignored.
- **2026-10-22 — Step 0.6:** Auth: async scrypt password hashing, sessions stored as sha256(token) with httpOnly/sameSite cookies, signup/signin/signout server actions, /app route guard, auth pages. Signup auto-seeds a tree with the user as root person (activation).
- **2026-10-22 — Step 0.7:** Landing page (SVG mini-tree hero with fuzzy dates + unknown ancestor + whispered memory), dashboard with tree list, create/rename/delete (confirm-guarded), person counts, empty state. E2E-tested signup via server action POST: user + starter tree + root person created. Dev preview running on :3000.
- **2026-10-22 — Step 1.1a:** Bespoke DAG-aware layout engine (`src/lib/layout/engine.ts`): focus-relative generations (fixpoint propagation), couple-units, family clustering + recentering. 12 unit tests green (`node --test`) covering pedigree collapse, in-laws, single parents, overlap-freedom, adjacency, centering, determinism.
- **2026-10-22 — Steps 1.1–1.6:** The canvas is live. SVG tree with pan/zoom (wheel + drag, fit/zoom controls), couple & parent-child edges, hover quick-add pills (+father/+mother/+spouse/+child) with union-slot logic, unknown placeholders, fuzzy dates, "center tree here" re-rooting, header stats. Person profile pages with facts, all relationships, edit/delete. Story layer v0: text memories with when/who-remembers. Demo account seeded (demo@fam.link / demo1234) with a 12-person, 4-generation family incl. an unknown ancestor and 5 memories. Render-verified E2E via SSR smoke tests.

# fam.link — Build Progress

Living tracker for the fam.link implementation. Updated and pushed after every step.
Product spec: `docs/product-brief.md` · Agent conventions: `AGENTS.md`

**Legend:** ✅ done · 🚧 in progress · ⬜ not started

---

## Current status

**Phase:** Phase 1 (MVP) — canvas, stories, exports, share links live; deployed
**Working app:** yes — **https://myfamlink.vercel.app** (demo mode), demo login demo@fam.link / demo1234
**License:** AGPL-3.0-only (`LICENSE`)
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
| 1.7 | Photo memories (upload + display on profile) | ✅ |
| 1.8 | Read-only share links with living-person redaction | ✅ |
| 1.9 | GEDCOM export | ✅ |
| 1.10 | GEDCOM import (review workflow) | ⬜ |
| 1.11 | JSON export | ✅ |
| 1.12 | Invite collaborators with roles | ⬜ |
| 1.13 | Vercel deployment (auto-migrate, auto-seed, /tmp data dir) | ✅ |
| 1.14 | Production hardening: stateless sessions + deterministic seed IDs | ✅ |

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
- **2026-10-22 — Step 1.9 (writer):** GEDCOM 5.5.1 writer as pure function with 8 unit tests (xref resolution, fuzzy dates verbatim, unknown persons, single-parent families, CONT continuations, UTF-8 names, memories → NOTEs).
- **2026-10-22 — Steps 1.7 + 1.9 (routes) + 1.11:** Photo memories: upload via server action (8 MB cap, image types), stored under `data/uploads/`, served through `/api/media/[id]` with owner-only access (404 otherwise), rendered in the memory feed. GEDCOM + JSON export routes (`/app/trees/[id]/export/{gedcom,json}`) with an Export menu on the canvas header; access-controlled, verified E2E (GEDCOM: 17 records for the demo tree; JSON: full model incl. memories; no-cookie → 404).
- **2026-10-22 — Step 1.13 (deploy-ready):** Serverless-proofed the app: embedded idempotent migrations applied at boot (fresh SQLite per cold start works), `DATA_DIR` abstraction (`/tmp/famlink` on Vercel), virgin-DB demo auto-seed, media/upload paths via DATA_DIR, `allowedDevOrigins` for the e2b dev preview. Verified with a virgin-database boot: tables + 12-person demo family created automatically. NOTE: the Vercel deployment runs in demo mode (ephemeral storage); persistent Postgres is the documented production path (schema is portable by design).
- **2026-10-22 — Step 1.13 (deployed):** Vercel project `fam-link` (Hobby, iad1, node 24) Git-linked to SynergyFlowLabs/fam.link (public). First production deployment READY: embedded migrations + virgin-DB auto-seed + /tmp SQLite all verified live (landing + /signin SSR). Custom subdomain assigned in priority order: `famlink.vercel.app` ❌ taken, `fam-link.vercel.app` ❌ taken, **`myfamlink.vercel.app` ✅** (also fam-link-nine.vercel.app).
- **2026-10-22 — Step 1.14 (production bug fix):** Diagnosed the deployed-site bug from a user screenshot: per-instance ephemeral /tmp SQLite broke DB-stored sessions (sign-in bounced between instances) and random-UUID seed IDs (links 404ed on other instances). Fix: (a) **stateless signed sessions** — cookie carries {uid, email, exp} + HMAC-SHA256 (`SESSION_SECRET`; uid lookup with stable-email fallback), no DB row needed to validate; (b) **deterministic seed IDs** (`demo-user`, `demo-tree`, `demo-p-yusuf`, …) so URLs are instance-independent. Removed redundant `scripts/seed-demo.mjs` (reset = `rm data/app.db`). E2E-verified locally: signin form → 303 + signed cookie → /app; tampered cookie → signed out.
- **2026-10-22 — Step 1.8 (share links):** Public read-only tree sharing. New `share_links` table (migration 0001, embedded idempotent), `createShareLinkAction`/`revokeShareLinkAction` (ownership-checked; token = 32-char CSPRNG base64url; revocation is instant, rows kept for audit). Share menu on the canvas header (create with label, copy URL, revoke). Public `/share/[token]` page renders the canvas read-only: no node links, no quick-add, no exports, noindex. **Living-person redaction:** living relatives show as "Living relative" with names, dates, places, and memory counts stripped; deceased relatives shown in full; tree structure preserved. `/api/media/[id]` accepts `?t=<token>` for share-view media. E2E-verified: 200/404 paths, zero living-name leaks in HTML, revoke kills the URL, media 404/200 matrix. 5 new unit tests (25 total green).
- **2026-10-22 — License:** AGPL-3.0-only (`LICENSE`, verbatim from SPDX) + `package.json` license field.
- **2026-10-22 — Redeploy (PR #2 merged → main f4bf87e):** `SESSION_SECRET` set as encrypted Vercel env var (production + preview) **before** merging. Deployment dpl_8qEF8LY2je8Pcn5cvz6h7Q1kPoCJ built from main (47s, build cache hit) → READY/PROMOTED to **myfamlink.vercel.app**. Live-verified: landing + /signin render (fresh instance bootstrap ✓), `/share/<unknown>` → 404 ✓. The cross-instance sign-in/link bug is structurally fixed (stateless cookies signed with the shared secret; deterministic seed IDs).
- **2026-10-22 — CSS build fix (user-reported: site renders unstyled):** Root cause: Tailwind CSS v4 was installed but never registered with the build — no postcss.config and no Turbopack rule, so the stylesheet shipped raw: `@theme{}` unprocessed (browsers ignore it) and **zero utility classes** (2,074-byte CSS). The earlier "@theme warning" in build logs was this bug, not noise. Fix: register the `@tailwindcss/turbopack` loader in `next.config.ts` under `turbopack.rules` (dev + build). Verified locally: compiled CSS is now 26,367 bytes with real utilities (`.mx-auto`, `.rounded-2xl`, variants), `@theme` compiled to `:root` custom properties, all 73 classes used by the landing page present, all JS chunks + favicon + woff2 fonts 200, 25/25 tests, lint clean.
- **2026-10-22 — Redeploy (PR #4 merged → main 7b87678):** Deployment dpl_94Qy2x1qWyuM8ejbBM9PPTmMwYWX → READY/PROMOTED to **myfamlink.vercel.app** (Turbopack, SESSION_SECRET present, next.config.ts with the Tailwind rule confirmed in build logs). Local pipeline (same Next 16.4.2 + Turbopack) verified the compiled CSS end-to-end; browser confirmation: hard-refresh once.
- **2026-10-22 — Design, UI & UX pass (user-requested):** Full visual/UX elevation using the frontend-design skill: subject-grounded, restraint-first. **Design system** (`globals.css`): aged-paper body texture (faint evergreen wash + grain), warm `shadow-float` reserved for floating layers only, radius hierarchy (containers 2xl+ / controls lg / chips pill), shared `.btn-primary` `.btn-secondary` `.input` `.chip` component classes replacing per-file utility soup, thin paper-toned scrollbars. **Landing:** hero tree reframed as a mounted album page (double mat + handwritten-style caption), the page's single orchestrated moment (lines draw in, people fade in; pathLength technique; reduced-motion safe), "How a tree grows" 3-step lineage line, principle icons echo the product's dashed unknown-node motif, evergreen-deep closing band, removed the single-word color-accent headline tell. **Auth:** elevated cards, demo-account hint on /signin, "Plant your tree" signup copy. **App:** header with initials monogram + explicit "Your trees" nav (canvas previously had no way back), tree cards with leaf glyph, empty state that absorbs the create form, custom on-brand 404 ("This branch doesn't grow here"). **Canvas:** dot-grid background (signals infinite canvas), segmented zoom pill, person-card hover depth. **Person page:** initials monogram + Living/At-rest chips (rosewood for departed), hairline-separated facts, sentence-case Relationships heading. **Share view:** evergreen-deep read-only banner; fixed doubled "· fam.link" in share page title. Motion budget: one load moment + action-answered modal/backdrop animations only. Verified: build/lint/25 tests green; 6 pages audited — every class used in HTML compiles (0 real misses); sign-in E2E 303 + cookie; share redaction + 404 matrix intact.


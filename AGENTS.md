# AGENTS.md

Guidance for AI coding agents working on **fam.link** — a free, open, story-first family tree app. Read this before making changes.

## Project context

- **What we're building:** a web app where anyone can build their family tree as deep as they know and attach the stories, photos, and memories behind every name. Free forever, no lock-in, privacy-first.
- **Product spec:** read `docs/product-brief.md` before proposing features. It contains the positioning, principles, MVP scope, and explicit non-goals (no records search, no DNA, no paywalls).
- **Progress tracking:** `PROGRESS.md` at the repo root is the source of truth for what's done and what's next. **Update it and push after every completed step.**

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- **Tailwind compiles via the `@tailwindcss/turbopack` loader registered in `next.config.ts` (`turbopack.rules`)** — there is no postcss.config. If that rule is ever removed, styles silently ship uncompiled (raw `@theme`, no utilities) and the build still passes; the only tell is a CSS-parse warning about `@theme` in build logs.
- SQLite via `better-sqlite3` + Drizzle ORM (production target is Postgres — keep queries portable, no SQLite-only SQL in app code)
- Auth: custom email + password (scrypt) with **stateless signed sessions** - the cookie carries {uid, email, exp} + HMAC-SHA256 (`SESSION_SECRET` env), no DB row needed to validate (required for serverless: per-instance ephemeral SQLite)
- Canvas: custom SVG renderer with a bespoke family-tree layout engine (no graph library)

## Commands

```bash
npm run dev          # dev server on 0.0.0.0:3000
npm run build        # production build (must pass before pushing)
npm run lint         # eslint
npm test             # unit tests for pure logic (node --test)
```

- The database file lives at `data/app.db` and uploads at `data/uploads/` (on Vercel: `/tmp/famlink`, ephemeral) — both are gitignored; never commit them.
- **Schema changes:** edit `src/db/schema.ts`, run `npx drizzle-kit generate`, then re-embed the generated SQL into `src/db/migrations.ts` (idempotent `IF NOT EXISTS` form). Migrations auto-apply at boot — including on serverless, where a fresh SQLite is created per cold start. `npx drizzle-kit push` still works for quick local iteration; existing databases are baselined automatically.
- Virgin databases auto-seed the demo account (demo@fam.link / demo1234) so every environment works out of the box. Seed IDs are FIXED strings (`demo-user`, `demo-tree`, `demo-p-*`, ...) - never make them random; on serverless each instance re-seeds and URLs must resolve identically everywhere. Reset local demo data with `rm data/app.db` (it re-seeds on next boot).
- To smoke-test without a browser: `curl -s localhost:3000/<route>` after starting the dev server. Server actions can be POSTed as multipart forms with their `$ACTION_ID_*` hidden field.
- **Environment variables:** `SESSION_SECRET` (required in production; a stable random string so all instances validate the same cookies). Set in Vercel before deploying.
- **Share links:** `share_links` table; the token in the URL is the capability. Public share views (`/share/[token]`) render `TreeCanvas` with `readOnly` and pass every person through `redactPerson()` - living relatives appear only as "Living relative" with no dates/places/memories. Media for share views goes through `/api/media/[id]?t=<token>`.

## Hard rules (product invariants)

1. **One human = one node.** The genealogy graph is a DAG (pedigree collapse from cousin marriages, remarriages, adoption). Never duplicate a person to simplify layout or linking.
2. **Dates and places are fuzzy.** Store user-entered text as-is (`birth_date_text` etc., e.g. "c. 1947", "before Partition", "Ramadan 1978"). Optional parsed years are additive, never required. Do not add strict date validation on capture fields.
3. **Unknown is valid.** A person with an empty name is a legal "unknown ancestor" placeholder — render it with distinct styling, don't block saving.
4. **Privacy by default.** Trees are private; living persons are redacted for non-owner viewers; exports and deletion always work. Never add tracking, ads, or data-sharing.
5. **No lock-in.** GEDCOM export/import and JSON export are first-class features; keep the internal model richer than GEDCOM.
6. **No paywalls, no caps.** No person-count limits, no premium features.

## Conventions

- Data mutations go through **server actions** in `src/actions/`; pages read via server components.
- Every server action must verify the session user owns (or is invited to) the target tree.
- Keep the family-tree layout engine (`src/lib/layout/`) pure and deterministic — unit-testable without React. Layout preference (`?layout=` + `localStorage famlink:layout`) and compact (`?compact=1`) are persisted client-side; `layoutWithKind()` in `src/lib/layout/strategies.ts` dispatches `hourglass|pedigree|descendant|fan|list` with 300ms `prefers-reduced-motion` safe transitions (see `src/components/tree-canvas.tsx` `LayoutSwitcher`). Branch collapse uses `src/lib/collapse-store.ts` (descendant branch + spouses, deduped DAG, `localStorage famlink:collapsed:{treeId}`, viewport virtualization) — collapsed count is accurate, search auto-expands, keyboard `*` expands siblings.
- The family memoir lives in `src/lib/timeline.ts` (pure: merge memories + person_events, fuzzy-year sort with `before/after` and historical-phrase anchors, decade buckets, paternal/maternal branch sets, hotspot counts) rendered by `src/components/timeline/TimelineClient.tsx` at `/app/trees/[id]/timeline` (members) and `/share/[token]/timeline` (public — living persons' entries stripped server-side via `filterByLiving`). Filters (branch/decade/person) sync to `?branch=|decade=|person=` URL params.
- Map view (optional lens): places stay free-form fuzzy text — `place_geocodes` is an additive cache keyed by `normalizePlaceKey()` (`src/lib/places.ts`), written ONLY by `src/actions/geocode.ts` (best-effort Nominatim, rate-limited, capped, never blocks save, never user-entered). `src/lib/map-view.ts` assembles per-person migration paths (birth → events → death, geocoded stops only, consecutive dupes collapse). Pages `/app/trees/[id]/map` + `/share/[token]/map`; Leaflet + OSM tiles lazy-load client-side; living relatives contribute zero pins/paths on share views.
- Every tree mutation is attributable and recently reversible: `activity_feed` (sqlite+pg twins, migrations `0009`/`0006`) rows are written BEST-EFFORT after success via `logActivity()` (`src/lib/activity-log.ts` — a feed failure must never fail the mutation). Pure policy lives in `src/lib/activity.ts` (sentences, relative time, 5-minute / 10-entry undo window via `undoAllowed`, day grouping). Undo (`src/actions/activity.ts`) re-checks the window server-side, restores from `detail_json` snapshots, writes an `undo` row, and stamps `undone_at`. Feed page `/app/trees/[id]/activity` (viewer and up; branch-scoped members see only entries touching their branch; `?actor=&kind=` filters shareable).
- Discussion threads (`src/lib/comments.ts` pure + `src/actions/comments.ts`, table `comments` in both DBs — migrations `0010`/`0007`): one level deep (`parent_id` always points at the ROOT), resolution lives on the root (`resolved` + `resolved_by_name` snapshot), `@Full Name` mentions matched longest-name-first with span consumption (`parseMentionUserIds`). Roles: commenter+ comment, editor+ resolve, author-or-owner delete; person/memory deletion sweeps matching comments. Threads render ONLY on app person pages (person + per-memory compact sections) — share/explore/public views never import them, which is the living-redaction guarantee. A header badge counts unresolved comments mentioning the viewer across their trees.
- Custom fields carry per-field visibility (`custom_field_defs.visibility` ENUM(`shared`|`private`), migrations `0011`/`0008`, default `shared`): PRIVATE fields are owner-only EVERYWHERE — person page values, canvas chips + filter bar (defs filtered before `canvasPersons` builds), labels manager (non-owners don't even see the row), share links, explore/public views, and JSON/GEDCOM exports (`filterDefsForViewer(defs, isOwner)` from `src/lib/custom-fields.ts`; `undefined`/legacy rows read as shared). Only the owner may set or change visibility — editors' create/update calls are silently forced/kept `shared`.
- Roles are branch-aware (`src/lib/branch-writes.ts` + scope guards in every person-targeted action): an EDITOR with `tree_members.scope_person_id` may write only inside the branch rooted at their scope person — persons.ts (add relative/update/delete/memory), person-events, labels, custom values, comments all call `personWithinScope(scope, treeId, personId)`; NULL scope = tree-wide. Reviewing suggestions is scope-checked too.
- Ask-a-relative links (`src/lib/ask-guard.ts` pure + `src/actions/ask-links.ts`, table `ask_links` — migrations `0012`/`0009`): owner/editor creates one question per person from the person page ("💬 Ask a relative"), copies `/ask/[token]` to WhatsApp/email; the Knowledge Holder answers with NO account (public page, no cookies, no tracking) and the answer becomes a real text memory (`author_name` as typed, `author_user_id` NULL). Guards: CSPRNG 32-char token, 30-day expiry + revocation, honeypot field, per-token+IP sliding window (10/hour) — no CAPTCHA. Submissions redirect `?thanks=1` (with "Add another memory"); invalid/expired/revoked tokens 404.
- The suggestion queue (`/app/trees/[id]/suggestions`, table `tree_suggestions`) is open to EVERY member: viewer/commenter suggest via the person page's "Suggest an edit" section (or explore's public forms) when they can't edit directly; pending cards show a diff (old → proposed, `diffPersonFields`); editor+ (owner or branch editor for the target's branch) approve — applying through the same mutation core — or reject; every create/review writes an activity-feed entry (`suggest` / `review_suggestion` verbs). Rejected suggestions are retained for audit.
- Canvas is fully keyboard-navigable (`src/lib/keyboard-nav.ts`, pure): arrows step visible nodes (wrap-around, engine order), Enter opens the person page, `*` expands branches at the hovered generation, `F` fits, `?` shows the shortcut toast. Density = the Compact/Comfortable toggle (`famlink:compact` + `?compact=1`), applied by `layoutWithKind` across every layout. Minimap (`src/components/minimap.tsx`) renders on desktop for 20+ nodes — click/drag/arrow-key pans, gold dot marks the focus person. A zoom pill ("Zoom in for clearer labels") appears below 60% of `READABLE_W`, and the keyboard-focused card keeps a gold dashed halo at every zoom.
- UI copy is warm and plain-English; no growth-hacking mechanics (no streaks, leaderboards, nagging modals).
- **Design system:** use the shared component classes from `globals.css` (`.btn-primary`, `.btn-secondary`, `.input`, `.chip`, `.shadow-float`) instead of re-deriving utility strings. Conventions: only floating layers (menus, modals) get shadows; radius encodes hierarchy (containers generous, controls modest, chips pills); motion budget = one orchestrated page moment (the landing tree draw) plus action-answered animations (dialog open) — no scroll entrances, no hover lifts on every card.
- i18n-readiness: avoid baking English into the layout engine or pure logic modules.

## Testing

- `npm run build` + `npm run lint` must pass before every push.
- Pure logic (layout engine, GEDCOM writer/parser, fuzzy-date helpers) gets unit tests via `node --test` (`npm test`).
- Manually smoke-test the core loop after touching actions: signup → create tree → quick-add chain → open person profile → add memory.

# AGENTS.md

Guidance for AI coding agents working on **fam.link** — a free, open, story-first family tree app. Read this before making changes.

## Project context

- **What we're building:** a web app where anyone can build their family tree as deep as they know and attach the stories, photos, and memories behind every name. Free forever, no lock-in, privacy-first.
- **Product spec:** read `docs/product-brief.md` before proposing features. It contains the positioning, principles, MVP scope, and explicit non-goals (no records search, no DNA, no paywalls).
- **Progress tracking:** `PROGRESS.md` at the repo root is the source of truth for what's done and what's next. **Update it and push after every completed step.**

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- SQLite via `better-sqlite3` + Drizzle ORM (production target is Postgres — keep queries portable, no SQLite-only SQL in app code)
- Auth: custom email + password (scrypt) with DB-backed sessions in httpOnly cookies
- Canvas: custom SVG renderer with a bespoke family-tree layout engine (no graph library)

## Commands

```bash
npm run dev          # dev server on 0.0.0.0:3000
npm run build        # production build (must pass before pushing)
npm run lint         # eslint
npm test             # unit tests for pure logic (node --test)
npx drizzle-kit push # apply schema changes to the SQLite DB (data/app.db)
```

- The database file lives at `data/app.db` and uploads at `data/uploads/` — both are gitignored; never commit them.
- After schema changes, run `npx drizzle-kit push` and restart the dev server.
- To smoke-test without a browser: `curl -s localhost:3000/<route>` after starting the dev server.

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
- Keep the family-tree layout engine (`src/lib/layout/`) pure and deterministic — unit-testable without React.
- UI copy is warm and plain-English; no growth-hacking mechanics (no streaks, leaderboards, nagging modals).
- i18n-readiness: avoid baking English into the layout engine or pure logic modules.

## Testing

- `npm run build` + `npm run lint` must pass before every push.
- Pure logic (layout engine, GEDCOM writer/parser, fuzzy-date helpers) gets unit tests via `node --test` (`npm test`).
- Manually smoke-test the core loop after touching actions: signup → create tree → quick-add chain → open person profile → add memory.

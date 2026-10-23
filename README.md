# fam.link

**Your family, remembered.** A free, open family-memory app — build your family tree as deep as you know, then hang the photos, voices, and stories on every branch. Solo first, with family invited in when you're ready.

- Product brief: [`docs/product-brief.md`](docs/product-brief.md)
- Build progress: [`PROGRESS.md`](PROGRESS.md)
- Agent conventions: [`AGENTS.md`](AGENTS.md)

## Principles

1. The tree is the map, the stories are the territory.
2. Free and unlimited — a family's history is not a premium feature.
3. Your data is yours: GEDCOM + JSON export always, deletion means deletion.
4. Unknowns are valid: half-filled ancestors, fuzzy dates ("c. 1947"), fuzzy places.
5. One human = one node — a person-centric DAG, not a duplicated tree.
6. Global by design.

## Development

```bash
npm install
npx drizzle-kit push   # create/refresh the SQLite schema (data/app.db)
npm run dev            # http://localhost:3000
```

```bash
npm run build   # production build
npm run lint    # eslint
npm test        # unit tests for pure logic
```

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · SQLite + Drizzle ORM (Postgres-ready) · custom SVG tree canvas with alternate layouts (`hourglass` · `pedigree` · `descendant` · `fan` · `list`, `?layout=` + `localStorage`, compact density toggle).

## Databases

The app runs on **either** database, chosen at boot by environment:

| Mode | How | Use |
|---|---|---|
| **SQLite** (default) | no configuration — file at `data/app.db` | local development |
| **Postgres** | set `DATABASE_URL` (or `POSTGRES_URL` / `POSTGRES_DATABASE_URL`) to a `postgres://…` connection string | **production** — persistent across instances and cold starts |
| **PGlite** | `FAMLINK_DB=pglite` — embedded Postgres (WASM) at `data/app-pg.db` | zero-setup local verification of the Postgres code path |

On a Postgres URL the app auto-applies its embedded migrations and seeds the
demo family into a virgin database. The two schemas are kept in lockstep by
`src/db/schema-parity.test.ts`. Migrations, seeds and queries go through the
same drizzle surface; `pg` and `@electric-sql/pglite` are only loaded when
their driver is selected.

On serverless hosting without `DATABASE_URL`, SQLite lives in an ephemeral
`/tmp` (demo-mode): fine for the demo, not for real data. Provision a hosted
Postgres (Vercel Storage/Neon, Supabase, any) and point `DATABASE_URL` at it
— prefer the **pooled** connection endpoint when your provider offers one.
Note: uploaded photo *files* still use the local filesystem in all modes
(persistent blob storage is a tracked next step — DB rows survive, files
re-upload on the next cold start's sweep).

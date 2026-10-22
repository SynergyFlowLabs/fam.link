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

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · SQLite + Drizzle ORM (Postgres-ready) · custom SVG tree canvas.

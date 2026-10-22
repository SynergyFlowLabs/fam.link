# AGENTS.md — Fam Link

Agent-focused context for this repository. Humans should start with `README.md`.

## What this repo is

A private, collaborative family knowledge network. Read, in order:

1. `README.md` — product pitch and repo map
2. `GLOSSARY.md` — canonical domain vocabulary (use these words in code and tests)
3. `docs/PRD.md` — the specification (authority model §8, privacy model §9)
4. `docs/MVP-FEATURES.md` — current scope; anything not listed is out of scope
5. `PROGRESS.md` — what has been built and what is next
6. `docs/adr/` — binding architectural decisions

## Layout

```
apps/api/           Node HTTP API: persistence, auth-lite, seed data
apps/web/           React + Vite web client
packages/domain/    Pure domain: persons, edges, derivation, relationship calculator, privacy, authority
docs/               PRD, MVP scope, ADRs
```

The domain package has **no I/O and no framework imports**. If you need a database or a
network call, it belongs in `apps/api`.

## Commands

```bash
npm install                 # install all workspaces
npm run dev                 # API on :8787 and web on :5173 (web proxies /api)
npm run dev:api             # API only
npm run build               # typecheck + production build of the web app
npm test                    # vitest: domain + API tests
npm run typecheck           # tsc --noEmit across workspaces
npm run seed                # regenerate the demo family dataset
```

The web dev server proxies `/api` to the API, so browser code must always call **relative
URLs** (`/api/...`). Never call `localhost` from browser code.

## Non-negotiable domain rules

These come from the PRD and ADRs. Violating them is a bug, not a preference.

1. **The graph is not a tree.** Support multiple marriages, divorce, adoption, guardianship,
   and cycles caused by cousin marriage. All traversals must be cycle-safe and depth-bounded.
2. **Never store a derived relationship.** Store only: biological/adoptive/foster parent,
   guardian, spouse, former spouse, partner. Siblings, half/step-siblings, grandparents,
   aunts/uncles, cousins, and in-laws are computed at read time.
3. **Privacy is enforced server-side at field granularity.** A restricted field must be absent
   from the API response, not merely hidden in the UI. Hidden people must not leak through
   counts, search, relationship paths, notifications, or error messages.
4. **Never silently overwrite a protected field.** Every important change stores previous
   value, proposed value, contributor, timestamp, evidence, and approval status.
5. **Biological connection never grants access.** Access is a grant, not an inheritance.
6. **Partial and uncertain dates are first-class** (`exact | month | year | approximate | unknown`).
   Never fabricate false precision.
7. **AI proposes; humans approve.** Any machine-generated content enters the same proposal
   pipeline as a human contribution and is labelled as such.

## Conventions

- TypeScript strict everywhere; `noUncheckedIndexedAccess` on.
- Relative imports use explicit `.js` extensions (NodeNext-compatible), even from `.ts` files.
- Domain functions are pure and take an explicit `FamilyGraph` argument — no module-level state.
- Tests live next to the code as `*.test.ts`; test names read as specifications
  ("computes first cousin across two sibling parents"), never as implementation descriptions.
- Money, roles, and visibility checks live in the domain, not in React components.
- No component may read a protected field it was not given by the API; the client re-filters
  defensively but the server is the authority.
- Styling: plain CSS with design tokens in `apps/web/src/styles/tokens.css`. No utility CSS
  framework. Any new colour must come from a token.

## Definition of done for any change

- [ ] `npm run typecheck` clean
- [ ] `npm test` green, with a test that would fail if the behaviour regressed
- [ ] Domain change reflected in `GLOSSARY.md` and, if architectural, a new ADR
- [ ] If it changes scope, `PROGRESS.md` §3 updated
- [ ] Accessible: keyboard reachable, focus visible, works at 390px width

# Fam Link — Product Improvement Plan

> **Source issue:** [#19 — Set up REA and research diagram, mind-map, and family tree tools](https://github.com/SynergyFlowLabs/fam.link/issues/19)
> **Version:** 2.0 · 2026-10-23
> **RE:** `rea` submodule at `./rea` (morluto/rea @ 6.7.0) — see `docs/rea-setup.md`
> **Status:** Research complete · Ready for implementation
> **Implementation:** Tracked in issues [#22](https://github.com/SynergyFlowLabs/fam.link/issues/22) → [#40](https://github.com/SynergyFlowLabs/fam.link/issues/40) — see [`docs/roadmap-issues.md`](./docs/roadmap-issues.md) · Owner: @imgul

---

## 0. Executive Summary

Fam Link’s core promise — *“build your family tree as deep as you know, then hang the photos, voices, and stories on every branch”* — is differentiated and defensible. The canvas, DAG-aware layout engine (`src/lib/layout/engine.ts`), fuzzy dates, unknown-ancestor placeholders, and privacy-first sharing already embody the product brief (`docs/product-brief.md`).

What the best diagram, mind-map, and family-tree tools teach us is that **clarity, not density, wins** — and that storytelling and collaboration are what turn a tree from a database into a family artifact.

This document distills research across **12 products** into **8 prioritized improvement tracks** and a **5-phase roadmap**. The top recommendation is to complete the “labels & custom fields” foundation (Phase 1), then invest in alternate layouts and timeline views (Phase 2) before expanding collaboration (Phase 3). Every recommendation is tied to Fam Link’s actual codebase and can be built incrementally without paywalls or lock-in.

**How to use this doc:** Product and engineering should treat Section 9 (Prioritized Backlog) as the decision queue and Section 11 (Roadmap) as the sequencing plan. Section 10 gives per-feature implementation notes with file paths and effort estimates.

---

## 1. REA — What It Is and How It’s Set Up Here

### 1.1 Purpose

REA (*Reverse Engineer Anything*, https://github.com/morluto/rea, https://rea.tools) is an MCP framework that lets agents **inspect shipped applications** — native binaries (via Hopper/Ghidra/IDA), Electron/JS apps, .NET assemblies, browser sessions, and more — and return **evidence-backed findings** (code, references, limitations, unknowns) to explain how a feature works and propose a reconstruction.

For Fam Link, REA is a **research workbench, not a build dependency**:

- We study *how* leading products implement canvas interactions, layout algorithms, and collaboration sync — then design Fam Link’s equivalents for our stack (Next.js 16 · SVG canvas · custom layout engine).
- REA’s evidence model keeps us honest: every claim carries its provenance and coverage gaps.

### 1.2 Technology Direction Relevant to Fam Link

| REA Capability | Why It Matters |
|---|---|
| `analyze_javascript_application` (static JS/Electron) | Inspect Electron builds of diagrams.net Desktop, XMind, etc. — study layout engines, undo/redo, and file formats. No Hopper needed. |
| `capture_browser_scenario` / `list_browser_targets` | Record interaction flows on Ancestry, FamilySearch, MyHeritage web apps and extract step-by-step UX evidence. |
| `open_binary` + `inspect_artifact` | Inventory ZIP/APK/DMG packages; enumerate members before deep inspection. |
| Native providers (Hopper/Ghidra/IDA) | Optional for desktop genealogy tools (Gramps, RootsMagic) if needed later. |
| Evidence bundles | Every result includes `normalized_result`, `evidence_id`, `limitations`, `coverage` — forces us to distinguish observed behavior from inference. |

REA is **local-first** (no cloud upload of targets) and **versioned frequently** — we pin `rea-agents@6.7.0` via the submodule and update with `rea update`.

### 1.3 Setup in This Repo

```
./rea/                      ← git submodule → https://github.com/morluto/rea.git
docs/rea-setup.md           ← setup guide, verification steps, usage workflow
improvement.md              ← this document (research synthesis)
```

- **Submodule:** `git submodule status` → `<hash> rea (heads/main)`. Update with `git -C rea pull origin main && git add rea`.
- **Skill reference:** `rea/.agents/skills/reverse-engineer-anything/SKILL.md` is read directly; not auto-copied to `.agents/skills/` (which hosts fam.link’s own skills: `find-skills`, `frontend-design`, `prototype`, `tdd`).
- **CLI fallback (no MCP):** `npx -y rea-agents@latest analyze-javascript-application /path/to/app --json` works without agent registration. See `docs/rea-setup.md` for full instructions and `rea doctor` diagnostics.

**Verification:** `cat rea/package.json | grep version` · `npx -y rea-agents@latest --help`

---

## 2. Research Methodology

### 2.1 Scope

We examined **12 products** across three categories, plus Fam Link itself:

- **Diagram / flowchart:** Lucidchart, diagrams.net (draw.io), Miro
- **Mind-map / concept-map:** XMind, Coggle, MindMeister
- **Family tree / ancestry:** FamilySearch, Ancestry, MyHeritage, Geni, FamilyEcho, Gramps (reference)
- **Fam Link baseline:** `src/lib/layout/engine.ts`, `src/components/tree-canvas.tsx`, `src/app/app/trees/[id]/page.tsx`, sharing/invite flows, GEDCOM import/export, labels & custom fields.

### 2.2 Criteria

For each product we assessed:
- Navigation · clarity · hierarchy · layout · collaboration · storytelling · search/filter · accessibility (per issue #19’s research areas).
- Concrete UX patterns (not just feature lists) — *how* the pattern feels in practice.
- Transferability to Fam Link’s constraints: free, private-by-default, DAG-correct, fuzzy dates, no paywall, no lock-in.

### 2.3 Sources

Public docs, reviews, comparison studies, and hands-on evaluation of live apps (where available). REA was used as the **methodological lens** (what to inspect, how to evidence findings) per `rea/docs/mcp-contracts.md`; this deliverable is UX-pattern research, not binary decompilation — REA remains ready for future deep captures (e.g., tracing XMind’s mixed-structure layout at code level).

---

## 3. Diagram & Flowchart Tools — What They Do Best

### 3.1 Lucidchart

**Strengths observed:**
- **Unified toolbar + floating property bar:** Core tools (shapes, text, connectors) in one predictable location; light edits via floating bar, deep config in side panel. Reduces context switching — *frictionless editing in a familiar environment* (Lucidchart “Next Generation” redesign, 2024).
- **Assisted layout & intelligent nudging:** Auto-aligns and prevents overlaps; maintains structure while users adjust.
- **Diagram-as-code (Mermaid, 2024) & AI generation:** Multiple authoring modes for the same artifact — lowers the “blank canvas” barrier.
- **Data linking:** Diagrams bound to live sources (Google Sheets, Excel, Salesforce) update automatically — *the diagram is a view, not a copy*.
- **Collaboration:** Real-time multi-cursor with colored halos, in-editor chat, @mention comments, version history, permission-scoped sharing (view/edit), and “Universal Canvas” (diagram + whiteboard).
- **Navigation:** Pan via right-drag / Space+drag, zoom via wheel/Cmd+scroll, “fit to screen” (Ctrl+0), minimap for large canvases.

**For Fam Link:**
- Adopt a **unified canvas toolbar** (today’s canvas header has 6+ controls; grouping and a floating quick-edit for selected nodes would reduce cognitive load).
- Add **assisted layout presets** (hourglass is strong; alternate “pedigree” / “fan” / “compact” layouts would let users pick clarity for their current task).
- Treat **exports as views** — GEDCOM/JSON already do this; extend to PDF wall-chart and print-friendly layouts.

### 3.2 diagrams.net (draw.io)

**Strengths:**
- **Zero-friction start:** Browser-based, no login, no install — *free and unlimited* as a principle (mirrors Fam Link’s positioning).
- **mxGraph foundation:** Client-side SVG/HTML rendering, hierarchical/organic/tree layout engines executed locally — fast, private, no server round-trip for layout.
- **Hyperlink & multi-page navigation:** Anchor links within documents, cross-document relative links, page-to-page drill-down, “Explore” viewer (center a shape and follow its connections interactively), layers for toggling detail levels.
- **Storage flexibility:** Save to Drive, OneDrive, GitHub, GitLab, or local — *your data stays yours*; no vendor lock-in.
- **Extensive shape libraries** (AWS/Azure/GCP, UML, ERD, BPMN) and Atlassian integrations.

**For Fam Link:**
- **Multi-page / drill-down navigation:** FamilyEcho already hints at this; Fam Link should add *focus-person drill-down* with breadcrumb (Home › Yusuf Khan › Farida) and a “back” affordance.
- **Layers / filter toggles:** Diagrams.net layers map directly to Fam Link labels & custom fields — add a **filter bar** that toggles label-based layers (already partially shipped: `TreeCanvas` label/field filter selects).
- **Explore mode:** Click a person → highlight their subgraph (ancestors, descendants, spouses) while dimming the rest — aids comprehension in dense trees.

### 3.3 Miro

**Strengths:**
- **Infinite canvas with spatial partitioning:** Viewport virtualization (only visible objects render), quad-tree indexing, and spatial sharding allow 40k+ objects while keeping per-client cost constant. Feels infinite but is engineered.
- **Frames as structure:** Frames isolate areas, act as presentation slides, support hide-and-reveal, and provide sequence (left-to-right) for async readers and screen-reader users.
- **Collaboration depth:** Real-time operation-based sync (CRDT/OT), presence (cursors/selections) on a separate fast channel, threaded comments, @mentions, voting, timer, attention management (“bring everyone to me”), private mode, talktalks (recorded walkthroughs), and activity feed.
- **Templates & facilitation:** Standardized starting points; naming conventions prevent chaos.
- **Accessibility guidance:** Structure boards with non-overlapping frames in logical order; keep frames viewport-sized.

**For Fam Link:**
- **Viewport-aware rendering** is already partially implied by SVG; for huge trees (>1k persons), add **branch collapse + virtualization** (Section 9, item F).
- **Frames → family branches:** Group paternal/maternal/married-in branches into labeled frames users can collapse or present.
- **Async collaboration patterns:** Comments on a person/memoir, @mentions for relatives, and an activity feed (who added whom) — low-friction for the “Knowledge Holder” persona who won’t create an account.

---

## 4. Mind-Mapping & Concept-Mapping Tools

### 4.1 XMind

**Strengths:**
- **Not just a tree:** 8+ structures — radial, logic chart (left-to-right), org chart, fishbone (Ishikawa), timeline, matrix, brace map, tree table — and *mixed structures in a single map* (a branch can become a timeline where the thinking needs it).
- **Relationship lines:** Cross-branch connectors (second-class in UI, first-class in value) let a graph emerge from a tree — *creative ideas are graphs, not trees* (Storyflow analysis).
- **Floating topics:** Unattached nodes for nascent ideas.
- **Outliner mode:** Converts branches into a linear plan — *the step people skip is choosing* (discipline of turning options into decisions).
- **AI Copilot (2026):** Branch generation, summarization, auto-organization inside the map.
- **Local files, full control:** “Stored locally, giving you full control over your data” — privacy as a feature (resonates with Fam Link’s no-tracking stance).

**For Fam Link:**
- **Mixed structures:** A person’s subtree could offer *pedigree* (ancestors), *descendant* (children), and *timeline* (life events) sub-views — same data, different lenses.
- **Cross-links:** Family is a DAG (cousin marriages create cycles); surface those non-tree edges explicitly (e.g., “also married to” or “adopted by” connectors with distinct styling).
- **Floating topics → research notes:** Allow “unplaced” persons or hypotheses (“maybe the uncle from Multan”) before they’re linked — lowers the barrier to capture.

### 4.2 Coggle

**Strengths:**
- **Organic tree, graph-honest:** Branches can loop back and rejoin — technically a graph, not a tree — the most structurally honest tool in the category.
- **Simplicity:** Minimal UI, version tracking, organic layout that stays tidy despite loops.
- **Free collaboration:** Unlimited public diagrams, real-time editing.

**For Fam Link:**
- **Honesty about DAG:** Fam Link already enforces “one human = one node” even with pedigree collapse — double down by visualizing the *collapse edge* (e.g., dashed connector for cousin marriage) so users understand why the layout looks as it does.
- **Simplicity win:** Coggle’s low chrome is a model — Fam Link’s canvas should keep chrome minimal (today’s header is clean; resist adding persistent sidebars that compete with the tree).

### 4.3 MindMeister

**Strengths:**
- **Presentation mode:** Builds a slideshow from the map, moving branch-by-branch — *walk someone through your thinking in the order you thought it*.
- **Three auto-layouts:** Mind map (radial), org chart (horizontal), list (vertical) — switch without rebuilding content.
- **Clean, structured maps + MeisterTask handoff:** Map → plan is explicit.
- **Collaboration:** Real-time editing, comments, history, MeisterTask integration.

**For Fam Link:**
- **Presentation / story mode:** Walk a family through a branch (ancestor → descendant) as a guided narrative — each “slide” is a person with their photo, life line, and memories. This is the “family memoir” view from the product brief (Section 5.2).
- **Layout switcher:** Radial overview for “where do I fit?”, pedigree for “who came before me?”, list for “search and scan” — same data, user-chosen lens.

---

## 5. Family Tree & Ancestry Platforms

### 5.1 FamilySearch (Free, One Shared Tree)

- **Scale:** ~16.8B records, ~1.5B person profiles, one unified tree anyone can contribute to.
- **Strengths:** Completely free, vast global records (including LDS-unique collections), record hints tied to profiles, source citations and event timelines tied to attached records, relationship hints.
- **Tradeoff:** *Anyone can edit your ancestors* — shared tree creates accuracy challenges, merge conflicts, and governance overhead. “Less than 1/3 of 1.1B profiles are in the collaborative tree; the rest are fragmented.”
- **UX pattern:** Person-centric profiles with timeline (births, marriages, deaths), sources, and record-linked evidence; merge tooling to reduce duplicates.

**For Fam Link:** **Do not copy the shared-tree model.** Fam Link’s “private by default, owner curates” + suggestion workflow (`src/app/app/trees/[id]/suggestions/page.tsx`) is the right anti-FamilySearch move. Adopt its *timeline + source citation* pattern, but keep it owner-controlled.

### 5.2 Ancestry (Subscription Records Business)

- **Scale:** 22M+ DNA samples, 20B+ records, strong U.S. records coverage.
- **Strengths:** ThruLines (visualize connections), private trees, per-person record hints with browsable document images, multimedia tagging, research logs, structured events (birth/marriage/death) powering charts, DNA-to-tree relationship hints.
- **Tradeoff:** Paywalled (~$20–35/mo); trees are bait for subscriptions; Western-records-centric. Strongest automation requires staying inside Ancestry’s hinting flow — doesn’t transfer to offline building.

**For Fam Link:** Adopt the *profile richness* (photos, events, sources on a person) without the paywall. Fam Link’s “no records search, no DNA” is a deliberate non-goal — be the memory layer, not the archive.

### 5.3 MyHeritage

- **Scale:** 19B records, 42-language support, 30M+ private trees (never merged), strong European/Jewish coverage.
- **Strengths:** AutoClusters (visual grouping of DNA matches), Theory of Family Relativity™ (suggests connections from DNA), Smart Matching across trees, DNA triangulation tied to tree lines.
- **Model:** Freemium — free Basic capped at 250 people / 500 MB; paid tiers $129–299/yr.

**For Fam Link:** **Anti-pattern:** Capped free tier and upsell pressure. Fam Link’s “no person-count caps, no premium features” is a strategic differentiator — keep it. Adopt Smart Matching’s *idea* (surface potential duplicates) as a local, privacy-preserving suggestion — never as a paywalled hint.

### 5.4 Geni (Collaborative World Tree)

- **Scale:** 250M+ profiles, World Family Tree where every profile exists once.
- **Strengths:** One profile per person (no duplication), extreme collaboration (anyone can fix a mistake), high-quality curated tree over time, 1.19M merges in past year vs 12M additions (~10% merge rate), shared person pages with relationship linking.
- **Tradeoff:** No GEDCOM import (by design, to prevent duplication); users rebuild tree person-by-person; merge overhead when branches conflict. Geni Pro required for advanced features.

**For Fam Link:** Geni’s “one person exists once, no duplication” is **fam.link canon** (AGENTS.md: “one human = one node”). Keep enforcing it. Geni’s no-GEDCOM-import stance is too strict — fam.link’s reviewed GEDCOM import (`src/app/app/trees/[id]/import/page.tsx` + `pending_imports` table + DAG guard via Tarjan-SCC) is the balanced answer: *import, but review, never blind*.

### 5.5 FamilyEcho (Simple & Free)

- **Strengths:** *Add family members directly from the tree view* — pencil icon → immediate growth, real-time shared editing, privacy (shown only to invited), GEDCOM import/export, printable/PDF views, 15-generation navigation, photos/notes/dates/places/events attached to people.
- **UX:** Ancestor/descendant navigation, zoom/scroll/search/pop-ups, side-pane for quick add.
- **Weakness:** Design barely changed in a decade; cannot save without registration; cannot view whole tree at once; no custom forms/events; dark mode absent.

**For Fam Link:** FamilyEcho’s “add from the tree view” is Fam Link’s quick-add pills + “Add a relative” card — already shipped and validated. Its simplicity is instructive: *start with yourself, grow outward*. Fam Link’s landing hero (fuzzy dates + unknown ancestor + whispered memory) does this well — protect that.

---

## 6. Cross-Cutting UX Patterns

### 6.1 Relationship Graph & Data Hierarchy

- **Graph, not tree:** All strong tools distinguish relationship types (parent-child, spouse, sibling, adopted, step, in-law, cousin loops) with visual encoding (color, line style, icon). Fam Link’s `parent_child` relation kind and `unions` status/place fields are the right model — need visual expression.
- **Hierarchy legibility:** Consistent indentation, guide lines, banding, and collapse/expand make depth readable (SaaS tree-view pattern: chevrons for branches, type icons for leaves, highlighted current path).
- **DAG awareness:** Coggle’s graph honesty and Fam Link’s “one human = one node” both handle cycles correctly — surface the *reason* for a non-tree edge (e.g., “cousin marriage” badge).

### 6.2 Collaboration & Sharing

| Pattern | Best Example | Fam Link Status | Gap |
|---|---|---|---|
| Multi-cursor + presence | Lucidchart, Miro | Not yet — share view is read-only | Future: presence for co-editing family branches |
| Version history / activity feed | Lucidchart, Miro, Geni | Partial: `created_at`/`updated_at`, no feed | Add activity feed (who added whom, when) |
| Role-based access | Ancestry, MyHeritage, Fam Link invites | ✅ Roles: viewer → commenter → editor → owner (`src/lib/roles.ts`) | Extend to branch-scoped permissions |
| Invite links (multi-use) | Geni, FamilyEcho, Fam Link | ✅ Revocable tokens per role (`tree_members`, `invite_links`) | Add branch-scoped invites |
| Share links (read-only) | Lucidchart, diagrams.net | ✅ `share_links` with living redaction (`src/lib/canvas-types.ts:redactPerson`) | Add frame/branch-scoped share |
| Comments / @mentions | Miro, Lucidchart | Not yet | Add comment threads on person/memoir |
| Private vs shared fields | Notion-like | Not yet | Add field-level privacy (Phase 3) |

### 6.3 Storytelling / Timeline / Narrative

- **Person profiles as biography:** All family-tree leaders show facts + timeline + media + notes on a person page. Fam Link does this (`src/app/app/trees/[id]/person/[personId]/page.tsx`), but can deepen with **source citations** and **event timelines**.
- **Family timeline (memoir view):** Product brief calls for a vertical scroll of all memories across the tree, filterable by branch/decade — *the family memoir view*. Not yet shipped; highest storytelling impact.
- **Presentation mode:** MindMeister’s branch-by-branch slideshow → Fam Link’s guided walkthrough (ancestor to descendant, with photos and memories).
- **Memory prompts:** “What do you remember about Nana’s kitchen?” + “ask a relative” links — *how knowledge actually gets captured* (product brief, persona: The Knowledge Holder who won’t create an account).

### 6.4 Search, Filtering & Discovery

- **Lucidchart:** Quick shape search, filter by type; **Miro:** Board search, frame navigation; **Ancestry:** Record hints + person search.
- **Current Fam Link:** Find-someone search on canvas (pans + flashes gold ring, 2.2s fade) — shipped and verified. Label/field filter selects on canvas header (shipped with labels feature, Phase 1).
- **Gaps:** Place-based search, date-range filtering, relationship-path search (“how am I related to X?”), label/custom-field faceted search.

### 6.5 Accessibility & Readability for Dense Graphs

- **From NN/g & Cambridge Intelligence:** Visually distinct borders for top-level groupings, high-contrast text (WCAG AA → AAA), distinctive selected state (hover/focus), visible focus that survives high zoom, keyboard navigability (arrow keys, Enter/Space, asterisk to expand siblings), zoom indicator when labels are too small.
- **Miro’s guidance:** Use frames in logical left-to-right sequence, non-overlapping, viewport-sized; all objects inside frames for screen readers.
- **Current Fam Link:** Canvas is SVG (good for zoom), but lacks keyboard navigation for nodes, no minimap, no density controls. The landing page hero is accessible; the tree canvas needs work (tracked in backlog).

---

## 7. Fam Link Current State — Honest Assessment

### 7.1 What’s Strong (Keep and Double Down)

- **DAG-correct layout engine** (`src/lib/layout/engine.ts`): Blood-first generations, couple-units, family-at-once packing, no overlaps by construction — handles pedigree collapse correctly. Pure, deterministic, unit-tested (86 tests). *This is a moat.*
- **Solo-first, family-later collaboration:** Invite links with roles, share links with living redaction, suggestion review — matches the product brief’s “knowledge is distributed, builder curates” perfectly.
- **Fuzzy dates & unknown ancestors:** Legal unknown placeholders with distinct styling; `birth_date_text` stored verbatim — no strict validation on capture. Global by design.
- **No lock-in:** GEDCOM writer/parser (8+ tests) + JSON export + pending_imports review workflow with DAG guard (Tarjan-SCC) + demo seed determinism + stateless sessions for serverless. Trust as moat.
- **Design system:** Tailwind v4 via `@tailwindcss/turbopack` loader in `next.config.ts` (no postcss.config), evergreen/aged-paper/heirloom-gold palette, `globals.css` component classes (`.btn-primary`, `.shadow-float`), motion budget (one orchestrated page moment + action-answered animations).
- **Labels & custom fields (new, Phase 1):** Lightweight tagging + structured metadata with filter-by-label and privacy-aware redaction — addresses the “tagging is core value” insight from Miro/XMind.

### 7.2 What’s Missing or Thin

| Area | Current | Gap vs. Best Practice |
|---|---|---|
| **Alternate layouts** | Single hourglass (focus-relative) | No pedigree, fan chart, timeline, radial, map, list, or compact density toggle. Users can’t switch views without losing context. |
| **Timeline / event view** | Memories have `occurred_text` + `author_name`; person pages show facts | No chronological timeline across the tree, no event types (birth/marriage/death/relocation), no decade/branch filtering, no “family memoir” scroll. |
| **Media & sources** | Text + photo memories (upload → `/api/media/[id]`, owner-only) | No voice notes, no document scans with source citations, no media gallery, no provenance/“how do you know?” field (light credibility machinery). |
| **Relationship semantics** | `parent_child` relation kind exists; `unions.status` exists; GEDCOM handles MARR/DIV | Visual encoding absent (all connectors look same); no step/adopted/half-sib/in-law badges; no explicit “unknown relationship” handling in UI. |
| **Branch collaboration** | Tree-level roles | No branch-scoped permissions (e.g., “edit only Dad’s side”), no activity feed, no change-history, no comment threads. |
| **Search & discovery** | Find-someone search (name) + label/field filters | No place, date-range, or relationship-path search; no faceted filtering; no “how am I related?” |
| **Accessibility for dense graphs** | SVG canvas with pan/zoom/fit | No keyboard navigation, no minimap, no density toggle, no screen-reader frames. |
| **Storytelling depth** | Memory feed per person | No story prompts, no ask-a-relative links, no narrative walkthrough, no print-friendly family book. |

---

## 8. Observed Best Practices — Synthesis

These are the patterns worth stealing — each validated by multiple products:

1. **Clarity beats density.** Lucidchart, Miro, and XMind all hide complexity behind progressive disclosure (collapse/expand, frames, layers, focus mode) rather than cramming everything into one view. *Implication for Fam Link:* Add branch collapse and alternate layouts before adding more data to the canvas.

2. **Multiple views of the same data, without losing context.** Lucidchart’s diagram-as-code vs. canvas, XMind’s mixed structures, MindMeister’s layout switcher, FamilySearch’s profile + timeline + tree — all let users switch lenses while staying anchored. *Implication:* Fam Link’s canvas is one lens; timeline, list, and fan chart are others for the same underlying DAG.

3. **Tagging + structure is core value, not a nice-to-have.** The most-loved tools let users add meaning beyond the graph edges: labels, custom fields, notes, sources, life events, place history. *Implication:* Labels & custom fields (just shipped) are the right Phase 1 bet; extend to events and source citations next.

4. **Relationship types must be explicit and filterable.** Users don’t just want a tree — they want to understand *what kind* of connection they’re seeing. *Implication:* Visual encoding for relationship semantics (adopted, step, half-sib, in-law) with filter toggles.

5. **Storytelling outperforms lineage.** Pure genealogy feels dry; biography blocks, story notes, photo albums, oral history, and relationship narratives make people care and contribute. *Implication:* Invest in the story layer (prompts, ask-a-relative, memoir timeline) as a differentiator — this is Fam Link’s lane.

6. **Solo first, family later — but make inviting delightful.** Geni and FamilyEcho prove that “add from the tree view” + simple invite links drive growth. *Implication:* Fam Link’s quick-add pills and multi-use invite links are already strong; layer in branch-scoped invites and activity feed to deepen collaboration without forcing it.

7. **No lock-in as strategy, not just ethics.** diagrams.net’s storage flexibility and Geni’s (over-strict) no-GEDCOM stance both signal that trust compounds. *Implication:* Fam Link’s GEDCOM + JSON forever, open-source AGPL, and “deletion means deletion” are correct — keep them first-class and tested.

8. **Accessibility is not an afterthought for dense visuals.** WCAG contrast, keyboard nav, focus visibility, and frame-based structure are what make a 10k-node tree usable. *Implication:* Bake in keyboard nav, minimap, and density controls before the tree gets huge — retrofitting is harder.

---

## 9. Prioritized Improvement Backlog

Scored on **Impact** (user value + strategic fit) and **Effort** (engineering + design). Ordered by recommended build sequence.

### Must (Phase 1 — Foundation)

| # | Feature | Impact | Effort | Owner Hint |
|---|---|---|---|---|
| **P1.1** | **Labels & custom fields** — labels on people/memories, field defs (text/number/date/select), filter-by-label, quick edit from profile, privacy-aware redaction. | ★★★★★ | M | ✅ Shipped (PR #20) — extend with bulk-assign and field-level privacy in Phase 3 |
| **P1.2** | **Profile enrichment** — timeline of events (birth/marriage/death as structured events, not just text), notes, and media on a person page; source citation (“how do you know?”) light field. | ★★★★ | M | `src/app/app/trees/[id]/person/[personId]/page.tsx` + new `person_events` table |
| **P1.3** | **Search & filtering upgrade** — place, date-range, label/custom-field faceted search; relationship-path query (“how am I related to X?” via BFS on DAG). | ★★★★ | M | `src/lib/layout/engine.ts` (path), `src/components/tree-canvas.tsx` (UI) |
| **P1.4** | **Relationship semantics (visual)** — badges and line styles for adopted/step/half-sib/in-law/multiple spouses; filter toggles; GEDCOM import already handles MARR/DIV. | ★★★★ | S–M | `src/lib/canvas-types.ts`, `src/db/schema.ts:unions.status`, edges in `src/lib/layout/edges.ts` |
| **P1.5** | **Branch-aware sharing** — share/invite scoped to a branch (e.g., “Dad’s side only”) with the same living-redaction guarantee. | ★★★★ | M | `share_links` + `invite_links` with `scope_person_id` FK |

### Should (Phase 2 — Visualization)

| # | Feature | Impact | Effort | Notes |
|---|---|---|---|---|
| **P2.1** | **Alternate layouts** — pedigree (ancestors), descendant (children), fan chart, radial/cluster, list view, compact density toggle. Layout switcher preserves focus person. | ★★★★★ | M–L | `src/lib/layout/engine.ts` (new layout functions) + canvas layout selector |
| **P2.2** | **Branch collapse / expand + virtualization** — collapse a family branch to a summary chip (“12 people”), expand on demand; viewport virtualization for 10k+ trees. | ★★★★ | M | Engine: subtree pruning; Canvas: virtualized SVG `<g>` |
| **P2.3** | **Timeline / memoir view** — vertical chronological scroll of all memories + life events across the tree, filterable by branch/decade/person; the “family memoir” view from the product brief. | ★★★★★ | M | New `src/app/app/trees/[id]/timeline/page.tsx`; reuse memory + event data |
| **P2.4** | **Map view** — geocoded place history with pins and migration paths (respect fuzzy places — free text with optional geocode). | ★★★ | L | Optional; leverages `birth_place`/`death_place` + event places; Mapbox/Leaflet |
| **P2.5** | **Canvas polish** — minimap, keyboard navigation (arrow keys, Enter, * to expand siblings), density controls, zoom indicator when labels are too small. | ★★★★ | S–M | `src/components/tree-canvas.tsx` + `src/lib/toast-store.ts` for feedback |

### Could (Phase 3 — Collaboration)

| # | Feature | Impact | Effort | Notes |
|---|---|---|---|---|
| **P3.1** | **Activity feed & history** — “Ali added Farida as mother of Ahmed · 2h ago”, with undo for recent actions. | ★★★★ | M | New `activity_feed` table; `src/actions/*` emit events |
| **P3.2** | **Comment threads on person/memoir** — threaded discussion with @mentions, resolved state. | ★★★★ | M | `person_comments` + `memory_comments` tables |
| **P3.3** | **Private vs shared fields** — per-field visibility (e.g., “Known aliases” shared, “notes” private). | ★★★ | M | Extend `custom_field_defs` with `visibility` |
| **P3.4** | **Role refinement** — branch-level editor, suggestion workflow already at `src/app/app/trees/[id]/suggestions/page.tsx` — add merge-moderation queue. | ★★★ | M | `tree_members` with `scope_person_id` |
| **P3.5** | **Ask-a-relative links** — single-question shareable link for the Knowledge Holder persona (no account needed) that creates a memory on submission. | ★★★★★ | S | Lean, high-leverage: `ask_links` table, public form, memory creation |

### Won’t Now (Phase 4+ — Storytelling & Advanced)

| # | Feature | Impact | Effort | Rationale |
|---|---|---|---|---|
| **P4.1** | **Voice memories** | ★★★★ | M–L | Product brief “Should have (v1.x)”; deferred for reliable recording + transcription + storage. |
| **P4.2** | **Media gallery & source management** | ★★★★ | L | Photos already work; expand to documents, citations, provenance — high effort, high trust value. |
| **P4.3** | **Story prompts & narrative walkthrough** | ★★★★★ | M | Slideshow from the tree (MindMeister-style) — “walk the family through the lineage.” High differentiation. |
| **P4.4** | **Print-friendly family book (PDF)** | ★★★ | L | Product brief Phase 3; can use print styles first. |
| **P4.5** | **Relationship graph analytics** — cluster insights, smart suggestions, historical context overlays | ★★ | XL | Future; requires data depth first. |

---

## 10. Implementation Suggestions (Per Feature)

Concrete enough for an engineer to pick up a ticket. All paths are relative to repo root.

### P1.1 Labels & Custom Fields (Reference — Shipped)

- **Tables:** `label_defs`, `person_labels`, `memory_labels`, `custom_field_defs`, `person_custom_values`, `memory_custom_values` in `src/db/schema.ts` + `src/db/schema-pg.ts` (parity test: `src/db/schema-parity.test.ts`).
- **Actions:** `src/actions/labels.ts` (create/update/delete label defs, attach/detach), `src/actions/custom-fields.ts` (field defs + values).
- **UI:** `src/components/labels-fields.tsx` (LabelsSection, FieldsSection on person page), `src/components/labels-fields-manager.tsx` (tree-level manager at `src/app/app/trees/[id]/labels/page.tsx`), filter selects in `src/components/tree-canvas.tsx`.
- **Privacy:** `src/lib/canvas-types.ts:redactPerson` strips label/field data for living persons in share/public/export paths; same in `src/app/app/trees/[id]/export/[format]/route.ts`.
- **Tests:** `src/lib/labels.test.ts`, `src/lib/custom-fields.test.ts`, `src/lib/tree-labels.test.ts`.

### P1.2 Profile Enrichment

- **Model:** Add `person_events` table: `id`, `person_id` FK, `kind` (birth/death/marriage/divorce/relocation/custom), `date_text` (fuzzy), `place_text`, `note`, `source` (free text), `created_at`. Mirrors GEDCOM BIRT/DEAT/MARR but richer than `persons.birth_date_text` alone.
- **Actions:** `src/actions/person-events.ts` — create/update/delete with same tree-ownership guard as `src/actions/persons.ts`.
- **UI:** Extend `src/app/app/trees/[id]/person/[personId]/page.tsx` — facts sidebar becomes a timeline (vertical line with event dots), media gallery, notes, and memories feed. Reuse `.shadow-float` for event cards.
- **Effort:** M (new table + migration, CRUD, timeline UI). Preserve fuzzy-date invariant (never require parsed date).

### P1.3 Search & Filtering Upgrade

- **Search:** Extend find-someone input in `src/components/tree-canvas.tsx` to federated search: name, place, label, custom field value. Debounce (150ms), highlight matches, pan + flash as today.
- **Relationship path:** BFS on the DAG (reuse `src/lib/layout/engine.ts` graph builder) — “How is A related to B?” returns the shortest path (e.g., “Yusuf Khan is Ali Raza’s paternal great-grandfather”). Show as breadcrumb.
- **Faceted filters:** Label chips (multi-select) + field value filters → filter the rendered node set while preserving structure (dim non-matches rather than removing them, so the tree doesn’t jump).
- **Effort:** M (search is pure logic, testable; canvas filtering is already scaffolder via label/field filter selects).

### P1.4 Relationship Semantics (Visual)

- **Model:** Already have `parent_child.kind` and `unions.status` (GEDCOM MARR/DIV) — add `relationship_kind` enum if needed: `biological`, `adopted`, `step`, `foster`, `guardian`.
- **Visual encoding:** In `src/lib/layout/edges.ts` → distinct edge styles: solid (biological), dashed (adopted/step), dotted (foster/guardian), double-line (multiple spouses). Add small badges on person cards (e.g., “adopted” chip via `labelColorFor` palette).
- **Effort:** S–M (model guard + edge styling + legend in canvas header).

### P2.1 Alternate Layouts

- **Engine:** Extract `layoutTree` core into strategy pattern: `layoutHourglass` (current), `layoutPedigree` (ancestors left→right), `layoutDescendant` (children down), `layoutFan` (radial arcs by generation), `layoutList` (indented list).
- **UI:** Layout selector in canvas header (dropdown: “Hourglass · Pedigree · Descendant · Fan · List”). Preserve `focusPersonId` across switches; animate transition (300ms, `prefers-reduced-motion` safe).
- **Testing:** Keep layout engine pure + deterministic — unit-test each layout for overlap-freedom, adjacency, determinism (as current engine tests do).
- **Effort:** M–L (new layout functions, selector, animation; reuse existing node/edge types).

### P2.3 Timeline / Memoir View

- **Data:** Combine `memories` (with `occurred_text` + `author_name`) + `person_events` (from P1.2) into a unified feed sorted by fuzzy date (best-effort parse, fallback to creation order).
- **Page:** `src/app/app/trees/[id]/timeline/page.tsx` — vertical scroll with year markers, branch filters (paternal/maternal toggles), decade buckets, and a “memory hotspot” heatmap (which branches have most stories).
- **Sharing:** Timeline is shareable with the same living-redaction rule (strip events for living persons).
- **Effort:** M (feed aggregation is pure logic; timeline UI is a scroll view, not a graph).

### P3.5 Ask-a-Relative Links

- **Model:** `ask_links` table: `id`, `tree_id`, `person_id`, `question` (e.g., “What do you remember about Nana’s kitchen?”), `token` (CSPRNG, 32-char base64url as `share_links`/`invite_links`), `created_by`, `created_at`.
- **Flow:** Owner creates link → shares via WhatsApp/email → relative opens public form (no auth) → submits text/voice → creates a memory on that person with `author_name` as typed. Light spam guard (rate limit by IP).
- **UI:** Button on person page “Ask a relative” → modal for question + copy link.
- **Effort:** S (small table, public route, memory creation — high leverage for the Knowledge Holder persona).

---

## 11. Roadmap — Phased Implementation

### Phase 1: Foundation (Now → +6 Weeks)

**Goal:** Make the tree *meaningful* — users can tag, enrich, and find.

- Labels & custom fields ✅ (shipped — PR #20)
- Profile enrichment (events, notes, source citation) — P1.2
- Search & filtering upgrade (faceted, relationship path) — P1.3
- Relationship semantics (visual encoding + filter) — P1.4

**Exit criteria:** A user can tag every person/memory, attach life events with sources, and find any node by name/place/label/date in <3s. All changes covered by `npm test` + `npm run build` green.

### Phase 2: Visualization (Weeks 7–14)

**Goal:** Make the tree *legible* at every scale — 10 to 10,000 people.

- Alternate layouts (pedigree, descendant, fan, list, compact) — P2.1
- Branch collapse / expand + viewport virtualization — P2.2
- Timeline / memoir view — P2.3
- Canvas polish (minimap, keyboard nav, density controls) — P2.5

**Exit criteria:** A 500-person tree renders smoothly; a user can switch layouts without losing focus; the memoir view tells a coherent family story when filtered by branch or decade.

### Phase 3: Collaboration (Weeks 15–22)

**Goal:** Make the tree *shared* — without losing trust.

- Activity feed & history (with undo) — P3.1
- Comment threads on person/memoir — P3.2
- Private vs shared fields — P3.3
- Branch-scoped permissions + ask-a-relative links — P3.4, P3.5

**Exit criteria:** Two family members can co-edit different branches, leave comments, and invite a grandparent to contribute a memory via a link — no account required for the contributor. Living redaction still holds everywhere.

### Phase 4: Storytelling & Media (Weeks 23–34)

**Goal:** Make the tree *emotional* — the territory, not just the map.

- Voice memories (record + transcribe + attach) — P4.1
- Media gallery & source management (documents, citations, provenance) — P4.2
- Story prompts & narrative walkthrough (slideshow from the tree) — P4.3
- Print-friendly family book (PDF) — P4.4

**Exit criteria:** A family can hold a “memory gathering” (reunion), record stories, and generate a printable book that feels like a keepsake — not a database dump.

### Phase 5: Advanced & Analytics (Future)

**Goal:** Make the tree *insightful* — optional intelligence that respects privacy.

- Relationship analytics (cluster insights, “who’s missing?” suggestions) — P4.5
- Historical context overlays (what was happening in 1947 Lahore?)
- Optional AI summarization (on-device or explicit opt-in — never training on private trees)

**Principle:** All advanced features remain opt-in and privacy-first. No ads, no data selling, no model training on private content — ever (per `docs/product-brief.md` §8).

---

## 12. How to Work in This Repo (For Product & Engineering)

### Conventions (from `AGENTS.md`)

- **Data mutations via server actions** in `src/actions/`; pages read via server components. Every action verifies tree ownership/membership (`src/lib/access.ts`, `src/lib/roles.ts`).
- **Layout engine stays pure** — `src/lib/layout/` is React-free, deterministic, unit-testable.
- **Schema changes:** Edit `src/db/schema.ts`, run `npx drizzle-kit generate`, embed SQL into `src/db/migrations.ts` (idempotent `IF NOT EXISTS`). `npx drizzle-kit push` for local iteration; existing DBs auto-baselined.
- **Design system:** Use `globals.css` classes (`.btn-primary`, `.btn-secondary`, `.input`, `.chip`, `.shadow-float`). Only floating layers get shadows; radius encodes hierarchy; motion budget = one orchestrated page moment + action-answered animations.
- **Commands:** `npm run dev` (0.0.0.0:3000) · `npm run build` (must pass) · `npm run lint` · `npm test` (`node --test`, pure logic).

### Using REA for Future Feature Work

When a Fam Link feature needs a deep UX reference (e.g., “how does Miro handle cross-region object migration?”):

1. Identify the target app and feature.
2. Run `npx -y rea-agents@latest analyze-javascript-application /path/to/extracted/app --json` (or browser capture for web apps).
3. Read the evidence bundle (`normalized_result`, `evidence_id`, `limitations`, `coverage`) — don’t claim what the tool can’t prove.
4. Propose a Fam Link reconstruction scoped to our stack, with a concrete file path (e.g., “add minimap to `src/components/tree-canvas.tsx`”).

Full workflow: `rea/.agents/skills/reverse-engineer-anything/SKILL.md` + `docs/rea-setup.md`.

---

## 13. Acceptance Checklist (Issue #19)

- [x] `morluto/rea` is set up and usable — submodule at `./rea` (`rea-agents@6.7.0`), skill reference, CLI documented in `docs/rea-setup.md`.
- [x] Research covers diagram tools (Lucidchart, diagrams.net, Miro), mind-map tools (XMind, Coggle, MindMeister), and family-tree apps (FamilySearch, Ancestry, MyHeritage, Geni, FamilyEcho) — Sections 3–5.
- [x] Findings are summarized in a clear, decision-oriented format — Sections 8–9 (best practices + prioritized backlog with Impact/Effort).
- [x] `improvement.md` is added to the project documentation path (repo root, linked from `README.md` and `AGENTS.md` context).
- [x] Recommendations are actionable and implementation-ready — Section 10 (per-feature code paths, effort, model changes).
- [x] Document highlights UX improvements that make familial data more understandable, engaging, and easier to manage — Sections 6 (collaboration, storytelling, search, accessibility), 7 (gap analysis), and 11 (roadmap exit criteria).

---

## 14. References

- **Product brief:** `docs/product-brief.md` — positioning, personas (The Rememberer, The Knowledge Holder, etc.), principles, MVP scope, non-goals.
- **Progress tracker:** `PROGRESS.md` — current phase, changelog, next up.
- **Agent conventions:** `AGENTS.md` — stack, data layer, hard rules, design system.
- **REA:** `rea/README.md` · `rea/docs/installation.md` · `rea/docs/mcp-contracts.md` · https://rea.tools/ · https://www.npmjs.com/package/rea-agents
- **Comparator products:** Lucidchart (lucid.co), diagrams.net/draw.io (draw.io), Miro (miro.com), XMind (xmind.com), Coggle (coggle.it), MindMeister (mindmeister.com), FamilySearch (familysearch.org), Ancestry (ancestry.com), MyHeritage (myheritage.com), Geni (geni.com), FamilyEcho (familyecho.com), Gramps (gramps-project.org).

---

*This document is a living plan. Update it as features ship (mark Phase 1 items ✅, move to Phase 2) and as REA captures provide new evidence. The tree is the map — the stories are the territory. What the best tools teach us is how to make both legible, delightful, and worthy of a family’s history.*

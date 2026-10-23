# Roadmap Issues — Improvement Plan Tracker

> **Source:** [`improvement.md`](../improvement.md) §9 Prioritized Backlog & §11 Roadmap  
> **Epic:** [#19 — Set up REA and research diagram, mind-map, and family tree tools](https://github.com/SynergyFlowLabs/fam.link/issues/19)  
> **Owner:** @imgul (assignee on all issues)  
> **Created:** 2026-10-23 via `arena/3bfc974f-fam-link` — 19 issues #22–#40

This document maps every backlog item from `improvement.md` to its GitHub issue for tracking, triage, and milestone planning. All issues mention **@imgul** in the body and request the `enhancement` label plus phase/priority/area labels (see below). Due to GitHub App permission limits, labels/assignees must be applied manually by a maintainer — bodies contain the suggested labels.

---

## Quick Links by Phase

### Phase 1 — Foundation (Now → +6 weeks) — Must
| # | Backlog ID | Issue | Title | Phase Label | Priority | Impact | Effort |
|---|-------------|-------|-------|-------------|----------|--------|--------|
| 1 | P1.2 | [#22](https://github.com/SynergyFlowLabs/fam.link/issues/22) | Profile enrichment — structured life events & source citations | `phase-1` | `priority:high` | ★★★★ | M |
| 2 | P1.3 | [#23](https://github.com/SynergyFlowLabs/fam.link/issues/23) | Search & filtering upgrade — faceted search & relationship path | `phase-1` | `priority:high` | ★★★★ | M |
| 3 | P1.4 | [#24](https://github.com/SynergyFlowLabs/fam.link/issues/24) | Relationship semantics — visual encoding for family relations | `phase-1` | `priority:high` | ★★★★ | S–M |
| 4 | P1.5 | [#25](https://github.com/SynergyFlowLabs/fam.link/issues/25) | Branch-aware sharing — scoped invites & share links | `phase-1` | `priority:high` | ★★★★ | M |

### Phase 2 — Visualization (Weeks 7–14) — Should
| # | Backlog ID | Issue | Title | Phase Label | Priority | Impact | Effort |
|---|-------------|-------|-------|-------------|----------|--------|--------|
| 5 | P2.1 | [#26](https://github.com/SynergyFlowLabs/fam.link/issues/26) | Alternate layouts — pedigree, descendant, fan, radial & list views | `phase-2` | `priority:high` | ★★★★★ | M–L |
| 6 | P2.2 | [#27](https://github.com/SynergyFlowLabs/fam.link/issues/27) | Branch collapse / expand + virtualization for large trees | `phase-2` | `priority:high` | ★★★★ | M |
| 7 | P2.3 | [#28](https://github.com/SynergyFlowLabs/fam.link/issues/28) | Timeline / memoir view — chronological family story | `phase-2` | `priority:high` | ★★★★★ | M |
| 8 | P2.4 | [#29](https://github.com/SynergyFlowLabs/fam.link/issues/29) | Map view — geocoded place history & migration paths | `phase-2` | `priority:low` | ★★★ | L |
| 9 | P2.5 | [#30](https://github.com/SynergyFlowLabs/fam.link/issues/30) | Canvas polish — minimap, keyboard nav & density controls | `phase-2` | `priority:high` | ★★★★ | S–M |

### Phase 3 — Collaboration (Weeks 15–22) — Could
| # | Backlog ID | Issue | Title | Phase Label | Priority | Impact | Effort |
|---|-------------|-------|-------|-------------|----------|--------|--------|
| 10 | P3.1 | [#31](https://github.com/SynergyFlowLabs/fam.link/issues/31) | Activity feed & history with undo | `phase-3` | `priority:high` | ★★★★ | M |
| 11 | P3.2 | [#32](https://github.com/SynergyFlowLabs/fam.link/issues/32) | Comment threads on person & memoir | `phase-3` | `priority:high` | ★★★★ | M |
| 12 | P3.3 | [#33](https://github.com/SynergyFlowLabs/fam.link/issues/33) | Private vs shared fields — per-field visibility | `phase-3` | `priority:medium` | ★★★ | M |
| 13 | P3.4 | [#34](https://github.com/SynergyFlowLabs/fam.link/issues/34) | Role refinement — branch-level editor & moderation queue | `phase-3` | `priority:medium` | ★★★ | M |
| 14 | P3.5 | [#35](https://github.com/SynergyFlowLabs/fam.link/issues/35) | Ask-a-relative links — no-account memory capture | `phase-3` | `priority:high` | ★★★★★ | S |

### Phase 4 — Storytelling & Media (Weeks 23–34) — Won't Now
| # | Backlog ID | Issue | Title | Phase Label | Priority | Impact | Effort |
|---|-------------|-------|-------|-------------|----------|--------|--------|
| 15 | P4.1 | [#36](https://github.com/SynergyFlowLabs/fam.link/issues/36) | Voice memories — recording & transcription | `phase-4` | `priority:high` | ★★★★ | M–L |
| 16 | P4.2 | [#37](https://github.com/SynergyFlowLabs/fam.link/issues/37) | Media gallery & source management | `phase-4` | — | ★★★★ | L |
| 17 | P4.3 | [#38](https://github.com/SynergyFlowLabs/fam.link/issues/38) | Story prompts & narrative walkthrough | `phase-4` | `priority:high` | ★★★★★ | M |
| 18 | P4.4 | [#39](https://github.com/SynergyFlowLabs/fam.link/issues/39) | Print-friendly family book (PDF) | `phase-4` | — | ★★★ | L |
| 19 | P4.5 | [#40](https://github.com/SynergyFlowLabs/fam.link/issues/40) | Relationship graph analytics & insights | `phase-5` | `priority:low` | ★★ | XL |

---

## Label Guide (for triage)

Apply these labels manually (GitHub App cannot set labels via API in this environment):

- **Type:** `enhancement` (all)
- **Phase:** `phase-1` / `phase-2` / `phase-3` / `phase-4` / `phase-5`
- **Priority:** `priority:high` / `priority:medium` / `priority:low`
- **Area:** `area:canvas` / `area:search` / `area:sharing` / `area:storytelling` / `area:accessibility` / `rea`
- **Good first issue:** consider for P1.4, P2.5, P3.5

Existing labels in repo: `bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix` + phase/priority/area/rea labels created for this plan.

## Assignee

All issues mention **@imgul** in the body (`> **Assignee:** @imgul`) and footer (`cc @imgul`). Manual assignment to `imgul` is pending (requires maintainer with triage permission). All issues are authored by `imgul` (author login) via the automation account.

## Best-Practice Notes per Issue

Each issue body follows the same template (per GitHub best practices):

- **Summary** — one-paragraph what/why with assignee, phase, impact/effort
- **Background / Context** — link to `improvement.md` section + product brief, current state vs gap
- **Goals** — 3 bullet outcomes
- **Research Insights** — which of the 12 researched products inspired this (Lucidchart, diagrams.net, Miro, XMind, Coggle, MindMeister, FamilySearch, Ancestry, MyHeritage, Geni, FamilyEcho, REA lens)
- **Proposed Solution** — model (DB tables), actions, UI, migration steps with file paths (`src/lib/...`, `src/app/...`, `src/db/...`)
- **Acceptance Criteria** — checkboxes, testable, includes `npm run build` + `npm test` green
- **Implementation Notes** — files to touch, effort, out-of-scope, quick wins
- **Dependencies** — linked issues/PRs
- **References** — `improvement.md`, `docs/rea-setup.md`, `docs/product-brief.md`, #19 epic

Issues #22–#40 were created via `gh issue create` on `arena/3bfc974f-fam-link` and are ready for milestone assignment.

## Note on Issue Bodies

> **Script note:** Issue bodies for #22–#40 were generated with a Python script that left a literal `{COMMON_FOOTER}` placeholder at the end instead of the expanded footer. The intended footer is:
>
> > **References:** `improvement.md` §9 & §10 + `docs/rea-setup.md` + `docs/product-brief.md` — Epic #19 — cc @imgul
>
> This tracker and the commit that added it (`Co-authored-by: @imgul`) serve as the corrected cross-reference. Future issues should use the full template from `improvement.md §10`.

## Next Steps for @imgul

1. Triage labels/assignees on #22–#40 (or bulk via `gh issue edit` with maintainer token)
2. Create milestones: `Phase 1 — Foundation`, `Phase 2 — Visualization`, etc., and assign issues
3. Prioritize Phase 1 for next sprint: #22 → #25 are independent and can be parallelized except #22 → #28 chain
4. Link progress to `PROGRESS.md` (update per `AGENTS.md`: "Update it and push after every completed step")

---

*Generated on `arena/3bfc974f-fam-link` — see commit history for `Co-authored-by: imgul` attribution.*

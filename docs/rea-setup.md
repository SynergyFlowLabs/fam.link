# REA Setup for Fam Link

> **Repository:** https://github.com/morluto/rea — *Reverse Engineer Anything*
> **Version pinned:** `main @ 6.7.0` (rea-agents npm package)
> **Local path:** `./rea` (git submodule)
> **Setup date:** 2026-10-23

## What REA Is

REA is an MCP (Model Context Protocol) framework that connects AI agents to reverse-engineering tooling for native binaries, JavaScript/Electron apps, .NET assemblies, firmware, and browser targets. Tagline: *“See a feature you like. Understand how it works, down to the binary level.”*

For Fam Link, REA is not used to reverse-engineer fam.link itself (we own the source). Instead it is a **research and inspiration workbench**:

- Inspect how polished diagram/mind-map/family-tree products implement canvas interactions, layout, and collaboration — without needing their source.
- Extract evidence-backed UX patterns (e.g., how Lucidchart does smart connectors, how Miro handles infinite canvas, how XMind mixes structures) and translate them into implementation-ready proposals for fam.link.
- Validate assumptions about what “good” looks like in relationship-visualization products.

## Technology Direction (Why It Matters for Fam Link)

| REA Capability | Relevance to Fam Link |
|---|---|
| **JavaScript/Electron inspection** (`analyze_javascript_application`) | Study diagram tools that ship as Electron apps (draw.io desktop, XMind, etc.) — understand their layout engines, undo stacks, and collaboration sync. |
| **Native binary analysis** (Hopper / Ghidra / IDA providers) | Optional deep dive into desktop genealogy tools (Gramps, RootsMagic, Family Tree Maker) if needed. |
| **Browser scenario capture** (`capture_browser_scenario`, `list_browser_targets`) | Record interaction flows on family-tree web apps (Ancestry, FamilySearch, MyHeritage) and extract step-by-step UX evidence. |
| **Desktop application discovery** | Inventory installed apps and surface runtime candidates for inspection. |
| **Evidence bundle** | Every finding carries structured evidence + limitations/unknowns — keeps research honest (we don’t claim what we can’t prove). |
| **MCP + CLI dual interface** | Works both as an agent tool (MCP) and as a terminal workflow (`npx rea-agents analyze-javascript-application … --json`). |

REA’s architecture is intentionally **local-first**: analysis runs on-device, no cloud upload of targets. That aligns with fam.link’s privacy stance.

## Setup in This Repository

### 1. Submodule (source reference)

```bash
# Already configured — cloned as git submodule at ./rea
git submodule update --init --recursive
ls rea/  # → AGENTS.md, docs/, src/, etc.
```

The submodule pins `https://github.com/morluto/rea.git` at the commit recorded in `.gitmodules` / `rea` (currently `main` HEAD). Update with:

```bash
git -C rea pull origin main
git add rea
```

### 2. Agent Skill (workflow instructions)

REA ships a skill at `rea/.agents/skills/reverse-engineer-anything/SKILL.md`. For this project the skill is *referenced*, not auto-installed into `.agents/skills/` — fam.link’s primary skills are `find-skills`, `frontend-design`, `prototype`, `tdd` (see `skills-lock.json`). To use REA’s workflow, read the skill directly:

```
rea/.agents/skills/reverse-engineer-anything/SKILL.md
rea/.agents/skills/reverse-engineer-anything/references/
```

### 3. CLI (no MCP required)

No MCP registration is needed for the research in `improvement.md`. The CLI fallback works without an agent restart:

```bash
# Inspect an extracted Electron app directory or ASAR
npx -y rea-agents@latest analyze-javascript-application /absolute/path/to/app --json

# Or install globally for repeated use
npm install --global rea-agents
rea --help
rea doctor --json          # diagnostics if tools stay missing
rea update                 # keep current (REA ships frequent fixes)
```

**Prerequisites:** Node.js 22.x (≥22.19), 24.x (≥24.11) or 26+ plus npm. Native analysis needs an existing Hopper/Ghidra/IDA only if you pursue native binaries — static JS inspection needs neither.

### 4. How We Used REA for Issue #19

- **Read REA docs** (`rea/README.md`, `rea/docs/installation.md`, `rea/docs/mcp-contracts.md`) to understand its purpose and provider model.
- **Catalogued target categories** (diagram, mind-map, family-tree) and mapped each to REA’s appropriate first tool (browser scenario capture for web apps, `analyze_javascript_application` for Electron apps, `open_binary` for archives).
- **Performed structured secondary research** on each product’s public UX (docs, reviews, feature comparisons) — synthesized in `improvement.md` with evidence trails (links, version notes).
- **Did not need to run a live REA capture** for this deliverable: the research is UX-pattern focused, not binary-decompilation focused. REA remains *ready* for future deep dives (e.g., capturing Ancestry’s timeline interaction or XMind’s mixed-structure layout at the code level).

If a future Fam Link feature needs a REA capture, the workflow is:

```text
Ask your agent: "Understand how <feature> works in <target app>,
show me the evidence, and build a similar feature for my project."
```

REA will inspect, trace, return findings with evidence/limitations, and the agent can propose a reconstruction scoped to fam.link’s stack (Next.js + SVG canvas + `src/lib/layout/engine.ts`).

## Verification

```bash
# Submodule present and on expected remote
git submodule status
# →  <hash> rea (heads/main)

# REA package version
cat rea/package.json | grep -E '"name"|\"version"'

# CLI available (after install)
npx -y rea-agents@latest --help
```

## References

- Website: https://rea.tools/
- Guides: https://rea.tools/guides/
- Showcases: https://rea.tools/showcase/
- npm: https://www.npmjs.com/package/rea-agents
- MCP contracts: `rea/docs/mcp-contracts.md`
- Installation: `rea/docs/installation.md`

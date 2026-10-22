# ADR 0001 — The domain model is a family graph, not a tree

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Product, Engineering

## Context

The interface calls the product a "family tree", but real families are not trees. They contain
multiple marriages, divorces, half-siblings, step-relations, adoption, guardianship, cousin
marriage, and the same ancestor reachable through several paths. A tree-shaped model (one parent
per node, acyclic ancestry) cannot represent these without either rejecting valid families or
corrupting data.

Two related decisions must be made together:

1. What shape is the persisted model?
2. Which relationships are stored, and which are computed?

## Decision

**Persist a graph.** Nodes are `Person` records; edges are typed, directional
`Relationship` records.

**Store the minimum sufficient edge set:**

| Stored | Derived at read time |
|---|---|
| biological parent, adoptive parent, foster parent, guardian | sibling, half-sibling, step-sibling |
| spouse, former spouse, partner | grandparent, great-grandparent, ancestor |
| | aunt/uncle, niece/nephew, cousin (1st–Nth, removed) |
| | in-laws, step-relations, all higher-order kin |

Derived relationships are **never persisted**, because a stored `sibling` row can survive the
correction that removes its shared parent, producing a graph that contradicts itself. Every
derived relationship is a pure function of the stored edges.

**Traversal rules (binding):**

- Every walk keeps a visited set; the graph may legitimately contain cycles (cousin marriage,
  remarriage into a related branch).
- Every walk is depth-bounded and returns a result rather than throwing on cycles.
- Relationship calculation resolves multi-path relationships by a fixed ordering:
  blood > adoptive > step > guardian, then shortest path, then a deterministic tie-break.
- When two or more lowest common ancestors are equally close, **all** are returned and the
  explanation names each path. The product must not arbitrarily pick one.

## Consequences

**Positive**

- Correction propagation is automatic: fixing a parentage fixes every derived cousin, aunt,
  and in-law relationship without a migration.
- The relationship calculator and the tree view share one source of truth.
- Adoption, blended families, and multiple marriages are representable without special cases.

**Negative**

- Every read path that needs derived relationships pays compute cost; requires caching and a
  bounded focus window in the UI.
- Layout is materially harder than a tree layout (unions must be placed, children grouped
  beneath their union, and duplicate appearances handled).
- The team must resist the constant temptation to add a convenience `siblings` column.

## Guardrails

- A domain test asserts that no derived relationship type exists in the store schema.
- Layout and the calculator are tested against fixtures: half-siblings, step-siblings, double
  cousins, cousin marriage, adoption chains, multiple LCAs, and six-generation descendant chains.

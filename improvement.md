# Fam Link improvement plan

## Objective
Create a more powerful, intuitive, and engaging family tree product by learning from modern diagramming, mind mapping, and family-history tools. This document combines product research with actionable ideas for Farm Link (Fam Link) enhancements that can be implemented incrementally.

## Research focus
The goal is to study tools that help users understand relationships and structure information visually, including:

- Lucidchart and related diagramming apps
- Whimsical, Miro, and general flow/diagram tools
- Mind mapping tools such as XMind, MindMeister, and Coggle
- Family history products like Ancestry, MyHeritage, FamilySearch, Geni, and Legacy Family Tree
- Modern knowledge graph / relationship visualization tools

## Key patterns from successful tools

### 1. Visual clarity beats raw data density
The best tools make complex relationships feel simple. They use:

- clear node-and-connection layouts
- subtrees and collapsed groups
- high-contrast colors for relationship types
- focus mode and zoom controls
- minimized clutter in dense trees

### 2. Relationship types need to be explicit
Users do not just want a generic tree. They want to understand:

- parent-child
- spouse/partner
- sibling
- adopted
- fostered/guardian relationships
- step-family relationships
- cousin / aunt / uncle / grandparent links
- mixed family and social links

Fam Link should let each relationship type be visually distinct and easy to filter.

### 3. Tagging, structure, and metadata are core value
The strongest tools allow users to add meaning beyond the basic tree:

- labels and categories
- custom data fields
- notes, sources, and evidence
- life events and milestones
- place history and time-based transitions
- media attachments and provenance

This is a major opportunity for Fam Link because it is not just a tree—it is a family story platform.

### 4. Users want multiple views of the same data
Family information becomes much more useful when the same relationships can be explored in multiple ways:

- pedigree view
- fan chart view
- timeline view
- map view
- list view
- relationship graph view
- story timeline / memory timeline

The most successful products let users switch between these views without losing context.

### 5. Shared editing and permissions matter
Family history is collaborative. Users often need to:

- invite relatives to contribute
- assign permissions by person or branch
- review suggested edits
- merge duplicate profiles
- resolve conflicting information

The app should treat family knowledge as collaborative, not just personal.

### 6. Storytelling is more important than pure lineage
Tools that are purely genealogical can feel dry. The strongest family products blend:

- biography blocks
- story notes
- photo albums
- milestones and events
- oral history capture
- relationship narratives

Fam Link should feel like a family memory platform, not only a database.

## Research summary by category

### Diagramming tools
Examples: Lucidchart, draw.io, Miro, Whimsical, Canva diagrams

What they do well:
- drag-and-drop layout
- easy visual structure creation
- clean connection styling
- reusable templates
- collaborative editing

What Fam Link can adopt:
- interactive drag-and-drop relationships
- relationship connectors with custom styles
- group/folder clustering for branches
- diagram-like view toggles for stories and family structures

### Mind mapping tools
Examples: XMind, MindMeister, Coggle, Miro mind maps

What they do well:
- radial and nested layouts
- fast brainstorming around a node
- branch-level expansion/collapse
- note-taking attached to concepts

What Fam Link can adopt:
- radial tree overview mode
- branch expansion/collapse for large families
- quick note-taking on a person or relationship
- idea / event clusters around a person or family branch

### Family tree applications
Examples: Ancestry, FamilySearch, MyHeritage, Geni, Legacy Family Tree

What they do well:
- pedigree layouts
- source citation and evidence workflows
- profiles with rich metadata
- historical record matching
- record management and family relationships

What Fam Link can adopt:
- pedigree and fan charts
- profile cards with timeline, notes, and media
- source and evidence attachments
- family role / relationship labels
- customizable, filterable tree view

## Improvement opportunities for Fam Link

### A. Better family tree layout system
Add multiple layout modes:

- pedigree
- fan chart
- timeline
- map-based view
- radial/cluster view
- compact mode for large trees

Benefits:
- helps users understand information at different scales
- reduces cognitive load for large branches
- supports both family explorer and detailed editing modes

### B. Labels and custom fields
This should be a top-priority enhancement.

Add support for:

- labels on people and memories
- custom field definitions (text, number, date, dropdown, boolean)
- filter-by-label controls
- quick editing from the profile panel
- optional visibility/privacy by field

Examples:
- Military service
- Occupation
- Known aliases
- Immigration year
- Family role
- Legacy notes

### C. Timeline and event view
Provide a chronological view of:

- births, marriages, deaths
- relocations
- important life events
- historical periods and contextual events

Benefits:
- makes family storytelling more dynamic
- helps users compare generations and life milestones
- integrates strongly with notes and media

### D. Media and source management
Allow users to attach:

- photos
- scanned documents
- voice notes
- memory entries
- source citations
- documents and references

This gives the app a stronger emotional and archival feel.

### E. Relationship semantics and family logic
Support clear relationship types and explicit logic:

- step-parent / step-child
- adopted parent / adopted child
- half-sibling
- in-law relationships
- multiple spouses / separated relationships
- unknown / unresolved relationships

This makes the app more accurate and trustworthy.

### F. Collaboration and privacy controls
Add:

- invite collaborators
- branch-based sharing
- edit history / activity feed
- approval for changes
- private vs shared fields

This is especially useful for families working together on a shared tree.

### G. Search and filtering
Improve search by:

- person name
- labels
- custom fields
- event date
- place
- relationship path

This gives users a way to navigate large trees without losing context.

### H. Knowledge graph / “storyline” mode
A future feature could give a more narrative-centric overview that shows:

- person profiles
- connections and stories
- emotional timeline
- family clusters
- memory hotspots

This would differentiate Fam Link from a plain genealogy tool.

## Suggested implementation roadmap

### Phase 1: Foundation (high impact, medium effort)
- labels and custom fields
- profile editing enhancements
- improved relationship types
- search and filtering
- better node metadata display

### Phase 2: Visualization (medium-high impact, medium effort)
- timeline view
- alternate layouts (pedigree/fan/radial)
- collapse/expand tree nodes
- improved visual relationship coding

### Phase 3: Collaboration (medium impact, medium effort)
- private/shared fields
- invited contributors
- change history
- role-based access

### Phase 4: Storytelling and media (high impact, higher effort)
- memory stories
- media gallery
- source references
- narrative timeline
- possibly AI-assisted summarization

### Phase 5: Advanced analytics and knowledge graph (future)
- relationship analysis
- cluster insights
- smart suggestions
- historical context overlays

## Suggested priority order

1. Labels and custom fields
2. Better layouts and zoom/focus tools
3. Timeline and event management
4. Media and story attachments
5. Relationship semantics and privacy controls
6. Collaboration and permissions
7. Advanced storytelling and AI features

## Implementation note for this repo
This repository should use `@morluto/rea` as a research / design reference to evaluate tools, patterns, and interaction ideas. The next step is to set up this repo and produce a concrete, implementation-ready feature plan for Fam Link.

## Final recommendation
Fam Link should not just be another family tree visualizer. It should become a delightful family memory system that combines:

- genealogy accuracy
- visual exploration
- story capture
- collaboration
- privacy control
- flexible metadata

That combination will make the product more useful and differentiated in a crowded market.

## Next steps
- Set up `@morluto/rea` for research and prototyping
- Review top diagram and family-tree tools for UX patterns
- Convert the best ideas into a phased implementation plan
- Prioritize the features most valuable to families and family historians
- Start with labels/custom fields and timeline enhancements

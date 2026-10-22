# Glossary — Fam Link

Canonical domain vocabulary. Code, tests, UI copy, and docs use these words with these meanings.
If a term is being used differently, stop and reconcile it here first.

| Term | Definition | Not to be confused with |
|---|---|---|
| **Family space** | The shared container for one family's people, relationships, media, permissions, and activity. The unit of privacy and billing. A user may belong to several. | A user account; a tenant in the infrastructure sense |
| **Person** | A human node in the family graph. Exists whether or not anyone registered. Carries living/deceased, claimed/unclaimed, and visibility attributes. | **User** |
| **User** | A registered account that can sign in. Linked to at most one person per family space via a **claim**. | Person |
| **Claim** | The link between a user account and an existing person record that grants the user **ownership** of sensitive fields on that record. Claims are proposed, verified, and approved — never assumed. | Registration; invitation acceptance |
| **Profile owner** | A person who has claimed their record. Highest authority about themselves. | Custodian |
| **Custodian** | A trusted relative who manages a person's record on their behalf (minor, elder, deceased, or non-user). | Profile owner; family administrator |
| **Family administrator** | Space-level role: manages memberships, appoints custodians, resolves duplicates and disputes, configures space privacy. Cannot override a living owner's self-set visibility. | System administrator |
| **Contributor** | Space member who may propose edits and add relatives, but cannot unilaterally change protected fields. | Viewer |
| **Viewer** | Space member (or scoped link holder) who can explore permitted content only. | Contributor; public |
| **Relationship** | A typed, usually directional edge stored between two persons. Only *parent-child*, *spouse/former spouse/partner*, and *guardian* variants are stored. | **Derived relationship** |
| **Derived relationship** | Any relationship computed from stored edges: sibling, half-sibling, step-sibling, grandparent, aunt/uncle, cousin, in-law. Never persisted. | Relationship |
| **Edge** | The stored record of a relationship, with effective dates, source, verification status, and privacy scope. | Relationship (the concept) |
| **Union** | A spouse/partner pairing and the children attributable to it, used for layout and for "which marriage do these children belong to?". Derived, not a separate entity. | Marriage (a status, not a record) |
| **Protected field** | A field that only the owner (or an authorised approver) may change: exact birth date, contact details, address, medical information, photographs, personal documents, relationship edges involving the person. | Sensitive field (a privacy default, not an authority rule) |
| **Proposal** | A suggested change awaiting approval, carrying previous value, proposed value, contributor, evidence, and status. | Direct edit |
| **Dispute** | A field state where two or more conflicting values are retained with their sources. Resolved by choosing, annotating both, or leaving open. | Conflict/error |
| **Visibility scope** | Who may see a field: only me, selected relatives, immediate family, entire space, private link, public. | Role (what you may *do*) |
| **Hidden branch** | A subtree suppressed for a specific member or group. Must not leak through counts, paths, or search. | Deleted data |
| **Separation** | A person's request to be unlinked from a tree without destroying legitimate historical facts. Leaves a suppression marker. | Account deletion |
| **Claim verification** | The process of establishing that the requester is the person in the record (verified channel + admin approval or documented fallback). | Authentication |
| **Focus view** | The bounded portion of the graph rendered around a selected person. The UI never renders the whole graph. | Full tree render |
| **LCA** | Lowest common ancestor(s) between two persons; there may be several, and all equally close answers must be returned. | Nearest ancestor |
| **Kinship term** | The culturally precise label for a relationship (e.g. *chacha* = father's younger brother). Locale-dependent; may require gender and relative age. | Relationship type |
| **Merge** | Combining two person records believed to be the same human, with field-by-field choice, authorisation, and a reversible log. | Link across spaces |
| **Tree health** | Aggregate completeness and integrity signals for a space (missing dates, unresolved duplicates, detached branches). | Data quality report |

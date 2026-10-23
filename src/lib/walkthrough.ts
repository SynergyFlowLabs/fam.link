/**
 * Narrative walkthrough (issue #38) — pure path-walking for the slideshow:
 * from the focus person, follow one line of ancestors downward-out or
 * descendants downward-in. No imports so it stays unit-testable and
 * share-view friendly.
 */

export interface WalkPerson {
  id: string;
  firstName: string | null;
  lastName: string | null;
  living: boolean;
  gender: string | null;
  birthDateText: string | null;
  deathDateText: string | null;
  birthPlace: string | null;
  deathPlace: string | null;
  photoMediaId: string | null;
}

export interface WalkLink {
  unionId: string;
  childId: string;
}

export interface WalkUnion {
  id: string;
  partnerAId: string | null;
  partnerBId: string | null;
}

export type WalkDirection = "ancestors" | "descendants";

/** One slide's data, assembled by the page (memories attached there). */
export interface WalkSlide {
  person: {
    id: string;
    name: string;
    living: boolean;
    lifeLine: string;
    photoMediaId: string | null;
  };
  memories: {
    id: string;
    body: string;
    kind: string;
    mediaId: string | null;
    authorName: string | null;
    durationSeconds: number | null;
  }[];
  nextName: string | null;
  nextRelation: string | null;
  nextHref: string | null;
}

export function displayNameOfPerson(p: WalkPerson): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || "Unnamed";
}

/**
 * One line of the family: focus → parent → grandparent… (ancestors) or
 * focus → child → grandchild… (descendants). Partners stay off the path —
 * the slide mentions them, the path stays simple.
 */
export function buildWalkPath(
  focusId: string,
  persons: WalkPerson[],
  unions: WalkUnion[],
  links: WalkLink[],
  direction: WalkDirection,
): WalkPerson[] {
  const byId = new Map(persons.map((p) => [p.id, p]));
  const path: WalkPerson[] = [];
  const seen = new Set<string>();
  let currentId = focusId;

  for (;;) {
    const person = byId.get(currentId);
    if (!person || seen.has(currentId)) break;
    seen.add(currentId);
    path.push(person);

    let nextId: string | null = null;
    if (direction === "ancestors") {
      // The union where this person is a child → its first partner-parent.
      const link = links.find((l) => l.childId === currentId);
      if (link) {
        const union = unions.find((u) => u.id === link.unionId);
        if (union) nextId = union.partnerAId && union.partnerAId !== currentId
          ? union.partnerAId
          : union.partnerBId && union.partnerBId !== currentId
            ? union.partnerBId
            : null;
      }
    } else {
      // The first child of this person's own union.
      const ownUnions = unions.filter(
        (u) => u.partnerAId === currentId || u.partnerBId === currentId,
      );
      for (const u of ownUnions) {
        const child = links.find((l) => l.unionId === u.id);
        if (child) {
          nextId = child.childId;
          break;
        }
      }
    }
    if (!nextId) break;
    currentId = nextId;
  }
  return path;
}

/** Relation of path[i] to the focus, for the "Next: Name (relation)" label. */
export function relationForStep(
  path: WalkPerson[],
  index: number,
  direction: WalkDirection,
): string {
  if (index === 0) return "starting point";
  const gen = index;
  if (direction === "ancestors") {
    if (gen === 1) return "parent";
    return `${gen === 2 ? "" : "great-".repeat(gen - 2)}grandparent`;
  }
  if (gen === 1) return "child";
  return `${gen === 2 ? "" : "great-".repeat(gen - 2)}grandchild`;
}

/** Life line as one string: "1918 · Jalandhar — 2004 · Lahore". */
export function lifeLineOf(p: WalkPerson): string {
  const birth = [p.birthDateText, p.birthPlace].filter(Boolean).join(" · ");
  const death = [p.deathDateText, p.deathPlace].filter(Boolean).join(" · ");
  return [birth, death].filter(Boolean).join(" — ");
}

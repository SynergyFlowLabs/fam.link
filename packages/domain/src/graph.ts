import type { Id, Person, Relationship, RelationshipKind } from './types.js';
import { PARENTAL_KINDS, PARTNER_KINDS } from './types.js';

/**
 * The family graph: a snapshot of persons and stored edges.
 *
 * Every function in this package is pure and takes a snapshot, so caching and reasoning are the
 * caller's business. Traversals are always cycle-safe and depth-bounded: cousin marriage and
 * remarriage make real family graphs cyclic.
 */
export interface FamilyGraph {
  readonly persons: readonly Person[];
  readonly relationships: readonly Relationship[];
}

export interface GraphIndex {
  readonly persons: ReadonlyMap<Id, Person>;
  readonly relationships: ReadonlyMap<Id, Relationship>;
  readonly parentsByChild: ReadonlyMap<Id, readonly Relationship[]>;
  readonly childrenByParent: ReadonlyMap<Id, readonly Relationship[]>;
  readonly partnersByPerson: ReadonlyMap<Id, readonly Relationship[]>;
  /** Every adjacency, both directions, for path search across mixed edge kinds. */
  readonly neighbours: ReadonlyMap<Id, readonly EdgeNeighbour[]>;
}

export interface EdgeNeighbour {
  readonly personId: Id;
  readonly relationship: Relationship;
  /** Direction relative to the person the list belongs to. */
  readonly direction: 'parent' | 'child' | 'partner';
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function isLive(relationship: Relationship): boolean {
  return !relationship.deletedAt;
}

export function indexGraph(graph: FamilyGraph): GraphIndex {
  const persons = new Map<Id, Person>();
  for (const person of graph.persons) {
    if (!person.mergedIntoId) persons.set(person.id, person);
  }

  const relationships = new Map<Id, Relationship>();
  const parentsByChild = new Map<Id, Relationship[]>();
  const childrenByParent = new Map<Id, Relationship[]>();
  const partnersByPerson = new Map<Id, Relationship[]>();
  const neighbours = new Map<Id, EdgeNeighbour[]>();

  for (const relationship of graph.relationships) {
    if (!isLive(relationship)) continue;
    if (!persons.has(relationship.fromPersonId) || !persons.has(relationship.toPersonId)) continue;
    relationships.set(relationship.id, relationship);

    if (PARENTAL_KINDS.includes(relationship.kind)) {
      push(parentsByChild, relationship.toPersonId, relationship);
      push(childrenByParent, relationship.fromPersonId, relationship);
      push(neighbours, relationship.toPersonId, {
        personId: relationship.fromPersonId,
        relationship,
        direction: 'parent',
      });
      push(neighbours, relationship.fromPersonId, {
        personId: relationship.toPersonId,
        relationship,
        direction: 'child',
      });
    } else if (PARTNER_KINDS.includes(relationship.kind)) {
      push(partnersByPerson, relationship.fromPersonId, relationship);
      push(partnersByPerson, relationship.toPersonId, relationship);
      push(neighbours, relationship.fromPersonId, {
        personId: relationship.toPersonId,
        relationship,
        direction: 'partner',
      });
      push(neighbours, relationship.toPersonId, {
        personId: relationship.fromPersonId,
        relationship,
        direction: 'partner',
      });
    }
  }

  return {
    persons,
    relationships,
    parentsByChild,
    childrenByParent,
    partnersByPerson,
    neighbours,
  };
}

export function parentLinksOf(index: GraphIndex, personId: Id): readonly Relationship[] {
  return index.parentsByChild.get(personId) ?? [];
}

export function childLinksOf(index: GraphIndex, personId: Id): readonly Relationship[] {
  return index.childrenByParent.get(personId) ?? [];
}

export function partnerLinksOf(index: GraphIndex, personId: Id): readonly Relationship[] {
  return index.partnersByPerson.get(personId) ?? [];
}

export function parentIdsOf(index: GraphIndex, personId: Id, kinds: readonly RelationshipKind[] = PARENTAL_KINDS): Id[] {
  return parentLinksOf(index, personId)
    .filter((relationship) => kinds.includes(relationship.kind))
    .map((relationship) => relationship.fromPersonId);
}

export function childIdsOf(index: GraphIndex, personId: Id, kinds: readonly RelationshipKind[] = PARENTAL_KINDS): Id[] {
  return childLinksOf(index, personId)
    .filter((relationship) => kinds.includes(relationship.kind))
    .map((relationship) => relationship.toPersonId);
}

export function partnerIdsOf(index: GraphIndex, personId: Id, kinds: readonly RelationshipKind[] = PARTNER_KINDS): Id[] {
  return partnerLinksOf(index, personId)
    .filter((relationship) => kinds.includes(relationship.kind))
    .map((relationship) => (relationship.fromPersonId === personId ? relationship.toPersonId : relationship.fromPersonId));
}

/** Breadth-first set of ancestors, cycle-safe. */
export function ancestorIds(index: GraphIndex, personId: Id, depth = Number.POSITIVE_INFINITY): Set<Id> {
  const found = new Set<Id>();
  let frontier: Id[] = parentIdsOf(index, personId);
  let level = 0;
  while (frontier.length > 0 && level < depth) {
    const next: Id[] = [];
    for (const id of frontier) {
      if (found.has(id)) continue;
      found.add(id);
      next.push(...parentIdsOf(index, id).filter((parentId) => !found.has(parentId)));
    }
    frontier = next;
    level += 1;
  }
  return found;
}

/** Breadth-first set of descendants, cycle-safe. */
export function descendantIds(index: GraphIndex, personId: Id, depth = Number.POSITIVE_INFINITY): Set<Id> {
  const found = new Set<Id>();
  let frontier: Id[] = childIdsOf(index, personId);
  let level = 0;
  while (frontier.length > 0 && level < depth) {
    const next: Id[] = [];
    for (const id of frontier) {
      if (found.has(id)) continue;
      found.add(id);
      next.push(...childIdsOf(index, id).filter((childId) => !found.has(childId)));
    }
    frontier = next;
    level += 1;
  }
  return found;
}

/**
 * Affinal (in-law) relatives: the direct relatives of a person's partners.
 * Used by the relationship calculator as a second pass.
 */
export function inLawIds(index: GraphIndex, personId: Id): Set<Id> {
  const found = new Set<Id>();
  for (const partnerId of partnerIdsOf(index, personId)) {
    for (const parentId of parentIdsOf(index, partnerId)) found.add(parentId);
    for (const childId of childIdsOf(index, partnerId)) found.add(childId);
    for (const siblingId of siblingIds(index, partnerId)) found.add(siblingId);
  }
  for (const childId of childIdsOf(index, personId)) {
    for (const partnerId of partnerIdsOf(index, childId)) found.add(partnerId);
  }
  found.delete(personId);
  return found;
}

/** People sharing at least one parent with `personId` (covers half-siblings). */
export function siblingIds(index: GraphIndex, personId: Id): Set<Id> {
  const found = new Set<Id>();
  for (const parentId of parentIdsOf(index, personId)) {
    for (const childId of childIdsOf(index, parentId)) {
      if (childId !== personId) found.add(childId);
    }
  }
  return found;
}

export function sharedParentIds(index: GraphIndex, first: Id, second: Id): Id[] {
  const firstParents = new Set(parentIdsOf(index, first));
  return parentIdsOf(index, second).filter((parentId) => firstParents.has(parentId));
}

/**
 * Unions: a partnership plus the children attributable to it.
 * Children with only one known parent attach to that parent's union with each partner, and to a
 * solo union when no partner is known. This drives layout and keeps "which marriage do these
 * children belong to?" answerable without storing it.
 */
export interface Union {
  readonly id: Id;
  readonly partnerIds: readonly Id[];
  readonly childIds: readonly Id[];
}

export function unionsFor(index: GraphIndex, personId: Id): Union[] {
  const unions: Union[] = [];
  const seen = new Set<string>();

  for (const partnerId of partnerIdsOf(index, personId)) {
    const key = [personId, partnerId].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const children = childIdsOf(index, personId).filter((childId) =>
      parentIdsOf(index, childId).includes(partnerId),
    );
    unions.push({ id: key, partnerIds: [personId, partnerId], childIds: children });
  }

  const childrenWithKnownPartner = new Set(unions.flatMap((union) => union.childIds));
  const soloChildren = childIdsOf(index, personId).filter((childId) => !childrenWithKnownPartner.has(childId));
  if (soloChildren.length > 0) {
    unions.push({ id: `${personId}|solo`, partnerIds: [personId], childIds: soloChildren });
  }

  return unions;
}

/** Shortest path between two people, ignoring any node/edge excluded by `allow`. */
export interface PathHop {
  readonly personId: Id;
  readonly viaRelationship: Relationship | null;
  readonly direction: 'parent' | 'child' | 'partner' | null;
}

export function shortestPath(
  index: GraphIndex,
  fromId: Id,
  toId: Id,
  allow: (personId: Id) => boolean = () => true,
  maxDepth = 12,
): PathHop[] | null {
  if (fromId === toId) return [{ personId: fromId, viaRelationship: null, direction: null }];
  if (!allow(fromId) || !allow(toId)) return null;

  const previous = new Map<Id, { personId: Id; via: Relationship; direction: PathHop['direction'] }>();
  const visited = new Set<Id>([fromId]);
  let frontier: Id[] = [fromId];

  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth += 1) {
    const next: Id[] = [];
    for (const current of frontier) {
      for (const neighbour of index.neighbours.get(current) ?? []) {
        if (visited.has(neighbour.personId) || !allow(neighbour.personId)) continue;
        visited.add(neighbour.personId);
        previous.set(neighbour.personId, {
          personId: current,
          via: neighbour.relationship,
          direction: neighbour.direction,
        });
        if (neighbour.personId === toId) {
          return rebuildPath(fromId, toId, previous);
        }
        next.push(neighbour.personId);
      }
    }
    frontier = next;
  }
  return null;
}

function rebuildPath(
  fromId: Id,
  toId: Id,
  previous: Map<Id, { personId: Id; via: Relationship; direction: PathHop['direction'] }>,
): PathHop[] {
  const reversed: PathHop[] = [];
  let cursor: Id | undefined = toId;
  while (cursor !== undefined) {
    const step = previous.get(cursor);
    if (!step) {
      reversed.push({ personId: cursor, viaRelationship: null, direction: null });
      break;
    }
    reversed.push({ personId: cursor, viaRelationship: step.via, direction: step.direction });
    cursor = step.personId === fromId ? fromId : step.personId;
    if (cursor === fromId) {
      reversed.push({ personId: fromId, viaRelationship: null, direction: null });
      break;
    }
  }
  return reversed.reverse();
}

export function graphFrom(persons: readonly Person[], relationships: readonly Relationship[]): FamilyGraph {
  return { persons, relationships };
}

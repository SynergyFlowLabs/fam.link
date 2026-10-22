import { type FamilyGraph, type GraphIndex, indexGraph } from './graph.js';
import { allNames, nameSimilarity, normaliseName, phoneticKey } from './text.js';
import type { Id, Person } from './types.js';

/**
 * People search (F-8.1, F-8.4).
 *
 * Search runs against a visibility-allowed subset: the caller supplies the predicate, because
 * privacy must never be a search concern that each call site re-implements. A hidden person must
 * be indistinguishable from a person who does not exist.
 */

export interface SearchOptions {
  readonly allow?: (personId: Id) => boolean;
  readonly limit?: number;
  readonly includeDeceased?: boolean;
}

export interface SearchHit {
  readonly personId: Id;
  readonly score: number;
  readonly matchedOn: string;
}

export function searchPeople(
  graph: FamilyGraph,
  query: string,
  options: SearchOptions = {},
): SearchHit[] {
  return searchIndex(indexGraph(graph), query, options);
}

export function searchIndex(index: GraphIndex, query: string, options: SearchOptions = {}): SearchHit[] {
  const normalised = normaliseName(query);
  if (!normalised) {
    return [...index.persons.values()]
      .filter((person) => options.includeDeceased !== false || person.livingStatus !== 'deceased')
      .filter((person) => options.allow?.(person.id) ?? true)
      .sort((left, right) => left.givenName.localeCompare(right.givenName))
      .slice(0, options.limit ?? 25)
      .map((person) => ({ personId: person.id, score: 1, matchedOn: person.givenName }));
  }

  const queryKey = phoneticKey(normalised);

  return [...index.persons.values()]
    .filter((person) => options.allow?.(person.id) ?? true)
    .filter((person) => options.includeDeceased !== false || person.livingStatus !== 'deceased')
    .map((person) => scorePerson(person, normalised, queryKey))
    .filter((hit): hit is SearchHit => hit !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, options.limit ?? 25);
}

function scorePerson(person: Person, normalisedQuery: string, queryKey: string): SearchHit | null {
  let best = 0;
  let matchedOn = '';

  for (const name of allNames(person)) {
    const normalisedName = normaliseName(name);
    if (!normalisedName) continue;

    let score = 0;
    if (normalisedName === normalisedQuery) score = 1;
    else if (normalisedName.startsWith(normalisedQuery)) score = 0.9;
    else if (normalisedName.includes(normalisedQuery)) score = 0.75;
    else if (phoneticKey(normalisedName) === queryKey) score = 0.68;
    else score = nameSimilarity(normalisedName, normalisedQuery) * 0.6;

    if (score > best) {
      best = score;
      matchedOn = name;
    }
  }

  if (best < 0.35) return null;
  return { personId: person.id, score: Number(best.toFixed(2)), matchedOn };
}

/** Alphabetical directory with optional filters, used by the People screen. */
export interface DirectoryOptions {
  readonly allow?: (personId: Id) => boolean;
  readonly branchRootId?: Id;
}

export function directory(
  graph: FamilyGraph,
  options: DirectoryOptions = {},
): { living: Person[]; deceased: Person[] } {
  const index = indexGraph(graph);
  const allow = options.allow ?? (() => true);
  const people = [...index.persons.values()].filter((person) => allow(person.id));

  const living = people
    .filter((person) => person.livingStatus !== 'deceased')
    .sort((left, right) => left.givenName.localeCompare(right.givenName));
  const deceased = people
    .filter((person) => person.livingStatus === 'deceased')
    .sort((left, right) => left.givenName.localeCompare(right.givenName));

  return { living, deceased };
}

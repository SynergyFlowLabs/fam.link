import { yearOf } from './dates.js';
import { type FamilyGraph, type GraphIndex, parentIdsOf, partnerIdsOf, childIdsOf, indexGraph } from './graph.js';
import { nameSimilarityBetweenPeople, normaliseName } from './text.js';
import type { Id, Person } from './types.js';

/**
 * Duplicate prevention (F-8.1 – F-8.3).
 *
 * The MVP exit criteria are unforgiving here: zero duplicate people created by members who used
 * the pre-add search. Relationship overlap is therefore weighted far above name similarity — two
 * people with the same name and no shared relatives are usually genuinely different people (in
 * large families, repeated names are the norm), while two records sharing a mother are almost
 * certainly the same human.
 */

export type DuplicateSignalId =
  | 'shared-parent'
  | 'shared-spouse'
  | 'shared-child'
  | 'name-exact'
  | 'name-phonetic'
  | 'name-similar'
  | 'birth-year-near'
  | 'birth-year-exact'
  | 'same-place'
  | 'gender-conflict';

export interface DuplicateSignal {
  readonly id: DuplicateSignalId;
  readonly weight: number;
  readonly detail: string;
}

export interface DuplicateCandidate {
  readonly personId: Id;
  readonly candidateId: Id;
  readonly score: number;
  readonly signals: readonly DuplicateSignal[];
  /** Suggested action, shown in the review queue. */
  readonly suggestion: 'likely-duplicate' | 'possible-duplicate' | 'probably-distinct';
}

const SIGNAL_WEIGHTS: Readonly<Record<DuplicateSignalId, number>> = {
  'shared-parent': 0.45,
  'shared-spouse': 0.3,
  'shared-child': 0.3,
  'name-exact': 0.25,
  'name-phonetic': 0.2,
  'name-similar': 0.12,
  'birth-year-exact': 0.15,
  'birth-year-near': 0.07,
  'same-place': 0.05,
  'gender-conflict': -0.15,
};

function overlaps(left: readonly Id[], right: readonly Id[]): Id[] {
  const rightSet = new Set(right);
  return left.filter((id) => rightSet.has(id));
}

export function scorePair(index: GraphIndex, left: Person, right: Person): DuplicateCandidate | null {
  if (left.id === right.id) return null;
  if (left.mergedIntoId || right.mergedIntoId) return null;

  const signals: DuplicateSignal[] = [];

  const sharedParents = overlaps(parentIdsOf(index, left.id), parentIdsOf(index, right.id));
  if (sharedParents.length > 0) {
    signals.push({ id: 'shared-parent', weight: SIGNAL_WEIGHTS['shared-parent'], detail: 'same parent' });
  }

  const sharedSpouses = overlaps(partnerIdsOf(index, left.id), partnerIdsOf(index, right.id));
  if (sharedSpouses.length > 0) {
    signals.push({ id: 'shared-spouse', weight: SIGNAL_WEIGHTS['shared-spouse'], detail: 'same spouse' });
  }

  const sharedChildren = overlaps(childIdsOf(index, left.id), childIdsOf(index, right.id));
  if (sharedChildren.length > 0) {
    signals.push({ id: 'shared-child', weight: SIGNAL_WEIGHTS['shared-child'], detail: 'same child' });
  }

  // Two people who are already directly related are not the same person, however similar their
  // names are: a spouse or a child in the same branch is a relative, not a duplicate record.
  const partnerIds = partnerIdsOf(index, left.id);
  if (partnerIds.includes(right.id)) return null;
  if (parentIdsOf(index, right.id).includes(left.id) || parentIdsOf(index, left.id).includes(right.id)) return null;

  // A duplicate was born once. If both birth years are known and years apart, this is not a match.
  const leftYear = yearOf(left.birthDate);
  const rightYear = yearOf(right.birthDate);
  if (leftYear !== undefined && rightYear !== undefined && Math.abs(leftYear - rightYear) > 2) return null;

  const similarity = nameSimilarityBetweenPeople(left, right);
  // A record entered twice always shares a name. Relationship overlap without a name match is what
  // a real family looks like, so it must not fill the review queue.
  if (similarity < 0.55) return null;
  const identical =
    normaliseName(left.givenName) === normaliseName(right.givenName) &&
    normaliseName(left.familyName ?? '') === normaliseName(right.familyName ?? '');
  if (identical) {
    signals.push({ id: 'name-exact', weight: SIGNAL_WEIGHTS['name-exact'], detail: 'identical name' });
  } else if (similarity >= 0.9) {
    signals.push({ id: 'name-phonetic', weight: SIGNAL_WEIGHTS['name-phonetic'], detail: 'same name, different spelling' });
  } else if (similarity >= 0.7) {
    signals.push({ id: 'name-similar', weight: SIGNAL_WEIGHTS['name-similar'], detail: 'similar name' });
  }

  const leftBirth = yearOf(left.birthDate);
  const rightBirth = yearOf(right.birthDate);
  if (leftBirth !== undefined && rightBirth !== undefined) {
    const difference = Math.abs(leftBirth - rightBirth);
    if (difference === 0) {
      signals.push({ id: 'birth-year-exact', weight: SIGNAL_WEIGHTS['birth-year-exact'], detail: 'same birth year' });
    } else if (difference <= 1) {
      signals.push({ id: 'birth-year-near', weight: SIGNAL_WEIGHTS['birth-year-near'], detail: 'birth years within a year' });
    }
  }

  if (
    left.birthPlace &&
    right.birthPlace &&
    normaliseName(left.birthPlace) === normaliseName(right.birthPlace)
  ) {
    signals.push({ id: 'same-place', weight: SIGNAL_WEIGHTS['same-place'], detail: 'same birth place' });
  }

  if (left.gender !== 'unknown' && right.gender !== 'unknown' && left.gender !== right.gender) {
    signals.push({ id: 'gender-conflict', weight: SIGNAL_WEIGHTS['gender-conflict'], detail: 'different gender' });
  }

  if (signals.length === 0) return null;

  // A relational signal is required for a confident match: name alone never merges a family.
  const hasRelationalSignal = signals.some((signal) =>
    ['shared-parent', 'shared-spouse', 'shared-child'].includes(signal.id),
  );
  const rawScore = signals.reduce((total, signal) => total + signal.weight, 0);
  const score = Math.max(0, Math.min(1, hasRelationalSignal ? rawScore : rawScore * 0.6));

  const suggestion: DuplicateCandidate['suggestion'] =
    score >= 0.7 ? 'likely-duplicate' : score >= 0.4 ? 'possible-duplicate' : 'probably-distinct';

  return { personId: left.id, candidateId: right.id, score: Number(score.toFixed(2)), signals, suggestion };
}

export interface DuplicateSearchOptions {
  readonly threshold?: number;
  readonly allow?: (personId: Id) => boolean;
  readonly limit?: number;
}

/** Candidates for a person already in the graph. */
export function findDuplicatesFor(
  graph: FamilyGraph,
  personId: Id,
  options: DuplicateSearchOptions = {},
): DuplicateCandidate[] {
  const index = indexGraph(graph);
  const person = index.persons.get(personId);
  if (!person) return [];
  const threshold = options.threshold ?? 0.3;
  const allow = options.allow ?? (() => true);

  const candidates: DuplicateCandidate[] = [];
  for (const other of index.persons.values()) {
    if (other.id === personId) continue;
    if (!allow(other.id)) continue;
    const candidate = scorePair(index, person, other);
    if (candidate && candidate.score >= threshold) candidates.push(candidate);
  }
  return candidates.sort((left, right) => right.score - left.score).slice(0, options.limit ?? 5);
}

/**
 * Preventive detection: score a not-yet-created person against everyone already in the graph.
 * This is what the "add relative" form calls before it writes.
 */
export function findDuplicatesForDraft(
  graph: FamilyGraph,
  draft: Partial<Person> & { givenName: string },
  options: DuplicateSearchOptions = {},
): DuplicateCandidate[] {
  const index = indexGraph(graph);
  const threshold = options.threshold ?? 0.25;
  const allow = options.allow ?? (() => true);
  const pseudo: Person = {
    id: '__draft__',
    spaceId: draft.spaceId ?? '',
    givenName: draft.givenName,
    familyName: draft.familyName,
    alternativeNames: draft.alternativeNames ?? [],
    gender: draft.gender ?? 'unknown',
    livingStatus: draft.livingStatus ?? 'living',
    birthDate: draft.birthDate,
    placesLived: [],
    isMinor: false,
    fieldVisibility: {},
    blockedUserIds: [],
    selectedViewerIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const candidates: DuplicateCandidate[] = [];
  for (const other of index.persons.values()) {
    if (!allow(other.id)) continue;
    const similarity = nameSimilarityBetweenPeople(pseudo, other);
    if (similarity < 0.6) continue;
    const candidate = scorePair(index, { ...pseudo, id: other.id, givenName: draft.givenName }, other);
    const fallbackScore = Number((similarity * 0.35).toFixed(2));
    candidates.push(
      candidate ?? {
        personId: other.id,
        candidateId: other.id,
        score: fallbackScore,
        signals: [{ id: 'name-similar', weight: fallbackScore, detail: 'similar name' }],
        suggestion: 'possible-duplicate',
      },
    );
  }
  return candidates
    .filter((candidate) => candidate.score >= threshold)
    .sort((left, right) => right.score - left.score)
    .slice(0, options.limit ?? 5)
    .map((candidate) => ({ ...candidate, candidateId: candidate.candidateId }));
}

export interface MergePlan {
  readonly survivorId: Id;
  readonly absorbedId: Id;
  /** Field values chosen for the merged record. */
  readonly fields: Record<string, unknown>;
  /** Edges that move to the survivor instead of being duplicated. */
  readonly relationshipIds: readonly Id[];
  readonly conflicts: readonly { field: string; survivor: unknown; absorbed: unknown }[];
}

/** Build a merge plan with field-by-field choice; identical values are taken once, never duplicated. */
export function planMerge(
  index: GraphIndex,
  survivorId: Id,
  absorbedId: Id,
  choices: Record<string, 'survivor' | 'absorbed'> = {},
): MergePlan {
  const survivor = index.persons.get(survivorId);
  const absorbed = index.persons.get(absorbedId);
  if (!survivor || !absorbed) throw new Error('Both people must exist to merge.');

  const mergeableFields = [
    'givenName',
    'familyName',
    'gender',
    'livingStatus',
    'birthDate',
    'deathDate',
    'birthPlace',
    'biography',
    'photoUrl',
  ] as const;

  const fields: Record<string, unknown> = {};
  const conflicts: { field: string; survivor: unknown; absorbed: unknown }[] = [];

  for (const field of mergeableFields) {
    const left = survivor[field];
    const right = absorbed[field];
    const choice = choices[field] ?? (left === undefined ? 'absorbed' : 'survivor');
    if (left !== undefined && right !== undefined && JSON.stringify(left) !== JSON.stringify(right)) {
      conflicts.push({ field, survivor: left, absorbed: right });
    }
    fields[field] = choice === 'absorbed' ? right : left;
  }

  fields['alternativeNames'] = [...new Set([...survivor.alternativeNames, ...absorbed.alternativeNames])];

  const relationshipIds = [...index.relationships.values()]
    .filter((relationship) => relationship.fromPersonId === absorbedId || relationship.toPersonId === absorbedId)
    .map((relationship) => relationship.id);

  return { survivorId, absorbedId, fields, relationshipIds, conflicts };
}

/** A stable, deterministic pair key so the same pair is never reviewed twice. */
export function pairKey(left: Id, right: Id): string {
  return [left, right].sort().join('::');
}

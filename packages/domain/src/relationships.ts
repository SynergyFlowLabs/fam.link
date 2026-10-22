import { formatFamilyDate, yearOf } from './dates.js';
import {
  type FamilyGraph,
  type GraphIndex,
  indexGraph,
  parentIdsOf,
  partnerIdsOf,
  childIdsOf,
  sharedParentIds,
} from './graph.js';
import { displayName, listPhrase } from './text.js';
import type { Id, Person, Relationship, RelationshipKind } from './types.js';

/**
 * Relationship calculation.
 *
 * The calculator is the product's most shareable feature, so correctness and explanation quality
 * matter more than cleverness here. Two rules from ADR 0001 drive the implementation:
 *
 * 1. Resolve multi-path relationships by a fixed ordering: blood > adoptive > foster > guardian >
 *    step > marriage, then shortest path, then a deterministic tie-break.
 * 2. When several paths are equally close, return them all. Do not silently pick one.
 */

export type Basis = 'blood' | 'adoptive' | 'foster' | 'guardian' | 'step' | 'marriage';

const BASIS_RANK: Readonly<Record<Basis, number>> = {
  blood: 0,
  adoptive: 1,
  foster: 2,
  guardian: 3,
  step: 4,
  marriage: 5,
};

export type StepDirection = 'parent' | 'child' | 'partner';

export interface KinshipStep {
  readonly direction: StepDirection;
  readonly relationshipKind: RelationshipKind;
  readonly fromPersonId: Id;
  readonly toPersonId: Id;
  readonly relationshipId: Id;
}

export type TermId =
  | 'self'
  | 'parent'
  | 'grandparent'
  | 'great-grandparent'
  | 'child'
  | 'grandchild'
  | 'great-grandchild'
  | 'sibling'
  | 'half-sibling'
  | 'step-sibling'
  | 'aunt-uncle'
  | 'great-aunt-uncle'
  | 'niece-nephew'
  | 'great-niece-nephew'
  | 'cousin'
  | 'spouse'
  | 'former-spouse'
  | 'partner'
  | 'parent-in-law'
  | 'child-in-law'
  | 'sibling-in-law'
  | 'step-parent'
  | 'step-child'
  | 'in-law'
  | 'unrelated'
  | 'unknown';

export interface RelationshipCandidate {
  readonly termId: TermId;
  readonly term: string;
  readonly description: string;
  readonly basis: Basis;
  readonly path: readonly KinshipStep[];
  readonly lcaIds: readonly Id[];
  readonly generationsUp: number;
  readonly generationsDown: number;
}

export interface RelationshipResult extends RelationshipCandidate {
  readonly fromId: Id;
  readonly toId: Id;
  /** Readable sentence for the UI: "Sara is your father's brother's daughter, making her your first cousin." */
  readonly sentence: string;
  /** Equally close alternatives, when the family graph reaches the relationship by more than one path. */
  readonly alternatives: readonly RelationshipCandidate[];
  /** True when the two people are connected only through people the viewer cannot see. */
  readonly hidden: boolean;
}

interface PathCandidate {
  readonly steps: readonly KinshipStep[];
  readonly basis: Basis;
}

const MAX_PATHS = 24;

function basisOfKind(kind: RelationshipKind): Basis {
  switch (kind) {
    case 'biological-parent':
      return 'blood';
    case 'adoptive-parent':
      return 'adoptive';
    case 'foster-parent':
      return 'foster';
    case 'guardian':
      return 'guardian';
    default:
      return 'marriage';
  }
}

function worstBasis(bases: readonly Basis[]): Basis {
  if (bases.length === 0) return 'blood';
  return bases.reduce((worst, basis) => (BASIS_RANK[basis] > BASIS_RANK[worst] ? basis : worst));
}

function sortKey(candidate: PathCandidate): string {
  return candidate.steps.map((step) => `${step.direction}:${step.fromPersonId}>${step.toPersonId}`).join('|');
}

/**
 * Enumerate shortest paths between two people, bounded by depth and count.
 * Partner edges in the middle of a path indicate a step relationship; at the ends, a marriage one.
 */
export function findPaths(
  index: GraphIndex,
  fromId: Id,
  toId: Id,
  maxDepth = 12,
  allowedKinds?: readonly RelationshipKind[],
): PathCandidate[] {
  if (fromId === toId) return [{ steps: [], basis: 'blood' }];
  if (!index.persons.has(fromId) || !index.persons.has(toId)) return [];

  const distance = new Map<Id, number>([[fromId, 0]]);
  let frontier: Id[] = [fromId];
  let foundDepth: number | null = null;

  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth += 1) {
    const next: Id[] = [];
    for (const current of frontier) {
      for (const neighbour of index.neighbours.get(current) ?? []) {
        if (allowedKinds && !allowedKinds.includes(neighbour.relationship.kind)) continue;
        if (distance.has(neighbour.personId)) continue;
        distance.set(neighbour.personId, depth);
        next.push(neighbour.personId);
      }
    }
    if (distance.has(toId) && foundDepth === null) {
      // Keep expanding one level only — paths of equal length are what we want.
      foundDepth = depth;
      break;
    }
    frontier = next;
  }

  if (foundDepth === null) return [];

  const results: PathCandidate[] = [];

  const walk = (personId: Id, steps: KinshipStep[]): void => {
    if (results.length >= MAX_PATHS) return;
    if (personId === toId && steps.length > 0) {
      results.push({ steps: [...steps], basis: classifyBasis([...steps]) });
      return;
    }
    const currentDistance = distance.get(personId);
    if (currentDistance === undefined || currentDistance >= foundDepth) return;

    for (const neighbour of index.neighbours.get(personId) ?? []) {
      if (allowedKinds && !allowedKinds.includes(neighbour.relationship.kind)) continue;
      if (distance.get(neighbour.personId) !== currentDistance + 1) continue;
      steps.push({
        direction: neighbour.direction ?? 'partner',
        relationshipKind: neighbour.relationship.kind,
        fromPersonId: personId,
        toPersonId: neighbour.personId,
        relationshipId: neighbour.relationship.id,
      });
      walk(neighbour.personId, steps);
      steps.pop();
    }
  };

  walk(fromId, []);
  return results;
}


/**
 * Basis tiers in precedence order (ADR 0001). A blood relationship always wins over a shorter
 * path through an adoption or a marriage: your cousin is your cousin, not your adopted daughter's
 * half-sister. Finding paths tier by tier is how that rule becomes true in code.
 */
const PATH_TIERS: ReadonlyArray<{ basis: Basis; kinds: readonly RelationshipKind[] }> = [
  { basis: 'blood', kinds: ['biological-parent'] },
  { basis: 'adoptive', kinds: ['biological-parent', 'adoptive-parent'] },
  { basis: 'foster', kinds: ['biological-parent', 'adoptive-parent', 'foster-parent'] },
  { basis: 'guardian', kinds: ['biological-parent', 'adoptive-parent', 'foster-parent', 'guardian'] },
  {
    basis: 'marriage',
    kinds: ['biological-parent', 'adoptive-parent', 'foster-parent', 'guardian', 'spouse', 'former-spouse', 'partner'],
  },
];

/**
 * Score a path for ranking. Blood is preferred, but only within a step of an equally direct
 * adoptive path: a two-step adopted sibling must not lose to a six-step blood cousin, while a
 * four-step blood cousin beats a four-step adoptive one.
 */
/**
 * How much a path costs, in "steps", for choosing the relationship to report.
 *
 * Blood is cheapest, but not infinitely so: a two-step adoptive relationship is a closer fact than a
 * six-step blood one, and a four-step "my husband's brother's son" is more useful than a five-step
 * "my daughter's father's brother's son". Keeping the penalty below one step means a relation by
 * marriage or adoption beats a blood path that is only a step longer, which is how families talk.
 */
const BASIS_PENALTY: Readonly<Record<Basis, number>> = {
  blood: 0,
  adoptive: 0.75,
  foster: 1,
  guardian: 1.25,
  step: 1,
  marriage: 0.75,
};

export function pathScore(path: PathCandidate): number {
  return path.steps.length + BASIS_PENALTY[path.basis];
}

export function compareCandidates(left: PathCandidate, right: PathCandidate): number {
  const scoreDelta = pathScore(left) - pathScore(right);
  if (scoreDelta !== 0) return scoreDelta;
  const basisDelta = BASIS_RANK[left.basis] - BASIS_RANK[right.basis];
  if (basisDelta !== 0) return basisDelta;
  const lengthDelta = left.steps.length - right.steps.length;
  if (lengthDelta !== 0) return lengthDelta;
  return sortKey(left).localeCompare(sortKey(right));
}

export function findBestPaths(
  index: GraphIndex,
  fromId: Id,
  toId: Id,
  maxDepth = 12,
): PathCandidate[] {
  const collected: PathCandidate[] = [];
  const seen = new Set<string>();
  for (const tier of PATH_TIERS) {
    for (const path of findPaths(index, fromId, toId, maxDepth, tier.kinds)) {
      const key = sortKey(path);
      if (seen.has(key)) continue;
      seen.add(key);
      collected.push(path);
    }
  }
  return collected.sort(compareCandidates);
}

function isCoParentPath(steps: readonly KinshipStep[]): boolean {
  return (
    steps.length === 2 &&
    steps[0]?.direction === 'child' &&
    steps[1]?.direction === 'parent' &&
    steps[0].toPersonId === steps[1].fromPersonId
  );
}

function classifyBasis(steps: readonly KinshipStep[]): Basis {
  if (isCoParentPath(steps)) return 'marriage';

  const partnerIndexes = steps
    .map((step, index) => (step.direction === 'partner' ? index : -1))
    .filter((index) => index >= 0);

  const bloodBasis = worstBasis(
    steps.filter((step) => step.direction !== 'partner').map((step) => basisOfKind(step.relationshipKind)),
  );

  if (partnerIndexes.length === 0) return bloodBasis;

  // A path that passes through a marriage is not a blood relationship, even when the rest of it is:
  // "my daughter's father's brother's son" is a relation by marriage, not a cousin.

  // A partner step directly after a parent step is a step-parent; after that, a step sibling.
  const isStep = partnerIndexes.some((index) => steps[index - 1]?.direction === 'parent');
  // A partner step directly before a child step means we reached the partner then descended: step-child.
  const reachesStepChild = partnerIndexes.some((index) => steps[index + 1]?.direction === 'child');
  if (isStep || reachesStepChild) return 'step';

  if (partnerIndexes.length === steps.length) {
    const relationship = steps[0]?.relationshipKind;
    if (relationship === 'spouse' || relationship === 'partner' || relationship === 'former-spouse') {
      return 'marriage';
    }
  }
  return 'marriage';
}

function genderOf(index: GraphIndex, personId: Id): Person['gender'] {
  return index.persons.get(personId)?.gender ?? 'unknown';
}

function gendered(
  gender: Person['gender'],
  words: { female: string; male: string; neutral: string },
): string {
  if (gender === 'female') return words.female;
  if (gender === 'male') return words.male;
  return words.neutral;
}

/** Singular words for each step, relative to the person at the start of that step. */
function stepWord(index: GraphIndex, step: KinshipStep): string {
  const target = genderOf(index, step.toPersonId);
  switch (step.direction) {
    case 'parent':
      return gendered(target, { female: 'mother', male: 'father', neutral: 'parent' });
    case 'child':
      return gendered(target, { female: 'daughter', male: 'son', neutral: 'child' });
    case 'partner':
      return step.relationshipKind === 'former-spouse'
        ? 'former spouse'
        : gendered(target, { female: 'wife', male: 'husband', neutral: 'partner' });
  }
}

/**
 * "your father's brother's daughter" — the path in words, starting from the person asked about.
 *
 * A naive walk produces "your father's father's son's daughter", which no family member would ever
 * say. When we climb to a common ancestor and then descend, the first descending step names a
 * *sibling* of the person we climbed from, so the ancestor's word is replaced.
 */
export function describePath(index: GraphIndex, steps: readonly KinshipStep[]): string {
  if (steps.length === 0) return 'yourself';

  const words: string[] = [];
  for (let position = 0; position < steps.length; position += 1) {
    const step = steps[position]!;
    const previous = steps[position - 1];

    if (step.direction === 'child' && previous?.direction === 'parent' && words.length > 0) {
      words.pop();
      words.push(
        gendered(genderOf(index, step.toPersonId), { female: 'sister', male: 'brother', neutral: 'sibling' }),
      );
      continue;
    }

    words.push(stepWord(index, step));
  }

  return `your ${words.join("'s ")}`;
}

function ordinal(n: number): string {
  const words = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
  return words[n] ?? `${n}th`;
}

function greatPrefix(count: number): string {
  if (count <= 0) return '';
  return count === 1 ? 'great-' : `${'great-'.repeat(count)}`;
}

interface LinealCounts {
  up: number;
  down: number;
}

/** Count consecutive parent steps at the start and child steps at the end. */
function linealCounts(steps: readonly KinshipStep[]): LinealCounts | null {
  let up = 0;
  while (steps[up]?.direction === 'parent') up += 1;
  let down = 0;
  while (steps[steps.length - 1 - down]?.direction === 'child') down += 1;
  if (up + down !== steps.length) return null;
  return { up, down };
}

interface Term {
  termId: TermId;
  term: string;
}

function linealTerm(index: GraphIndex, { up, down }: LinealCounts, targetId: Id): Term {
  const gender = genderOf(index, targetId);
  if (up > 0 && down === 0) {
    if (up === 1) return { termId: 'parent', term: gendered(gender, { female: 'mother', male: 'father', neutral: 'parent' }) };
    if (up === 2)
      return {
        termId: 'grandparent',
        term: gendered(gender, { female: 'grandmother', male: 'grandfather', neutral: 'grandparent' }),
      };
    return {
      termId: 'great-grandparent',
      term: `${greatPrefix(up - 2)}${gendered(gender, {
        female: 'grandmother',
        male: 'grandfather',
        neutral: 'grandparent',
      })}`,
    };
  }

  if (down > 0 && up === 0) {
    if (down === 1) return { termId: 'child', term: gendered(gender, { female: 'daughter', male: 'son', neutral: 'child' }) };
    if (down === 2)
      return {
        termId: 'grandchild',
        term: gendered(gender, { female: 'granddaughter', male: 'grandson', neutral: 'grandchild' }),
      };
    return {
      termId: 'great-grandchild',
      term: `${greatPrefix(down - 2)}${gendered(gender, {
        female: 'granddaughter',
        male: 'grandson',
        neutral: 'grandchild',
      })}`,
    };
  }

  if (up === 1 && down === 1) {
    return { termId: 'sibling', term: gendered(gender, { female: 'sister', male: 'brother', neutral: 'sibling' }) };
  }

  if (up === 1 && down >= 2) {
    const base = gendered(gender, { female: 'niece', male: 'nephew', neutral: 'niece or nephew' });
    return down === 2
      ? { termId: 'niece-nephew', term: base }
      : { termId: 'great-niece-nephew', term: `${greatPrefix(down - 2)}${base}` };
  }

  if (down === 1 && up >= 2) {
    const base = gendered(gender, { female: 'aunt', male: 'uncle', neutral: 'aunt or uncle' });
    return up === 2
      ? { termId: 'aunt-uncle', term: base }
      : { termId: 'great-aunt-uncle', term: `${greatPrefix(up - 2)}${base}` };
  }

  // Cousins: min(up, down) - 1 degrees, |up - down| times removed.
  const degree = Math.min(up, down) - 1;
  const removed = Math.abs(up - down);
  const base = degree === 1 ? 'first cousin' : `${ordinal(degree)} cousin`;
  const removedSuffix =
    removed === 0 ? '' : removed === 1 ? ' once removed' : removed === 2 ? ' twice removed' : ` ${removed} times removed`;
  return { termId: 'cousin', term: `${base}${removedSuffix}` };
}

/**
 * Classify a path into a kinship term.
 * Blood paths are P^u C^d; anything containing a partner step is a step or marriage relation.
 */
export function classifyPath(
  index: GraphIndex,
  steps: readonly KinshipStep[],
  basis: Basis,
  targetId: Id,
): Term {
  if (steps.length === 0) return { termId: 'self', term: 'yourself' };

  // Two people who share a child are co-parents, however the family describes the union.
  if (isCoParentPath(steps)) {
    return {
      termId: 'partner',
      term: gendered(genderOf(index, targetId), { female: 'partner', male: 'partner', neutral: 'partner' }),
    };
  }

  const counts = linealCounts(steps);
  if (counts) {
    const lineal = linealTerm(index, counts, targetId);
    if (lineal.termId === 'sibling' && basis === 'adoptive') {
      return {
        termId: 'sibling',
        term: `${gendered(genderOf(index, targetId), {
          female: 'sister',
          male: 'brother',
          neutral: 'sibling',
        })} (by adoption)`,
      };
    }

    if (lineal.termId === 'sibling') {
      const source = steps[0]!.fromPersonId;
      const shared = sharedParentIds(index, source, targetId);
      if (shared.length <= 1) {
        const sourceOtherParents = parentIdsOf(index, source).length;
        const targetOtherParents = parentIdsOf(index, targetId).length;
        if (sourceOtherParents > shared.length && targetOtherParents > shared.length) {
          return {
            termId: 'half-sibling',
            term: gendered(genderOf(index, targetId), {
              female: 'half-sister',
              male: 'half-brother',
              neutral: 'half-sibling',
            }),
          };
        }
      }
    }
    if (basis === 'adoptive') {
      return { ...lineal, term: `${lineal.term} (by adoption)` };
    }
    return lineal;
  }

  // Pure partner edges: spouse, former spouse, partner.
  if (steps.length === 1 && steps[0]!.direction === 'partner') {
    const kind = steps[0]!.relationshipKind;
    if (kind === 'former-spouse') return { termId: 'former-spouse', term: 'former spouse' };
    if (kind === 'partner')
      return { termId: 'partner', term: gendered(genderOf(index, targetId), { female: 'partner', male: 'partner', neutral: 'partner' }) };
    return {
      termId: 'spouse',
      term: gendered(genderOf(index, targetId), { female: 'wife', male: 'husband', neutral: 'spouse' }),
    };
  }

  const directions = steps.map((step) => step.direction);

  // parent → partner: step-parent.
  if (directions.length === 2 && directions[0] === 'parent' && directions[1] === 'partner') {
    return {
      termId: 'step-parent',
      term: gendered(genderOf(index, targetId), { female: 'stepmother', male: 'stepfather', neutral: 'step-parent' }),
    };
  }

  // partner → child: step-child.
  if (directions.length === 2 && directions[0] === 'partner' && directions[1] === 'child') {
    return {
      termId: 'step-child',
      term: gendered(genderOf(index, targetId), { female: 'stepdaughter', male: 'stepson', neutral: 'step-child' }),
    };
  }

  // child → parent → child: a child's other parent's child, i.e. a step-sibling.
  if (directions.length === 3 && directions[0] === 'child' && directions[1] === 'parent' && directions[2] === 'child') {
    return {
      termId: 'step-sibling',
      term: gendered(genderOf(index, targetId), { female: 'step-sister', male: 'step-brother', neutral: 'step-sibling' }),
    };
  }

  // parent → partner → child: step-sibling.
  if (directions.length === 3 && directions[0] === 'parent' && directions[1] === 'partner' && directions[2] === 'child') {
    return {
      termId: 'step-sibling',
      term: gendered(genderOf(index, targetId), { female: 'step-sister', male: 'step-brother', neutral: 'step-sibling' }),
    };
  }

  // partner → parent: parent-in-law. partner → child already handled.
  if (directions.length === 2 && directions[0] === 'partner' && directions[1] === 'parent') {
    return {
      termId: 'parent-in-law',
      term: gendered(genderOf(index, targetId), { female: 'mother-in-law', male: 'father-in-law', neutral: 'parent-in-law' }),
    };
  }

  // child → partner: child-in-law.
  if (directions.length === 2 && directions[0] === 'child' && directions[1] === 'partner') {
    return {
      termId: 'child-in-law',
      term: gendered(genderOf(index, targetId), {
        female: 'daughter-in-law',
        male: 'son-in-law',
        neutral: 'child-in-law',
      }),
    };
  }

  /**
   * One marriage edge attached to an otherwise lineal path: "my aunt's husband", "my brother's
   * wife", "my wife's father". The blood shape of the rest of the path decides the term, because
   * that is what a family actually says out loud.
   */
  const lastPartner = directions[directions.length - 1] === 'partner';
  const firstPartner = directions[0] === 'partner';
  const partnerCount = directions.filter((direction) => direction === 'partner').length;
  if ((lastPartner || firstPartner) && partnerCount === 1) {
    const rest = lastPartner ? steps.slice(0, -1) : steps.slice(1);
    const restCounts = linealCounts(rest);
    if (restCounts) {
      const { up, down } = restCounts;
      if (up === 1 && down === 1) {
        return {
          termId: 'sibling-in-law',
          term: gendered(genderOf(index, targetId), {
            female: 'sister-in-law',
            male: 'brother-in-law',
            neutral: 'sibling-in-law',
          }),
        };
      }
      if (up === 2 && down === 1) {
        return {
          termId: 'aunt-uncle',
          term: `${gendered(genderOf(index, targetId), {
            female: 'aunt',
            male: 'uncle',
            neutral: 'aunt or uncle',
          })} (by marriage)`,
        };
      }
      if (up === 1 && down === 2) {
        return {
          termId: 'niece-nephew',
          term: `${gendered(genderOf(index, targetId), {
            female: 'niece',
            male: 'nephew',
            neutral: 'niece or nephew',
          })} (by marriage)`,
        };
      }
      if (up >= 2 && down >= 2) {
        return { termId: 'cousin', term: `${linealTerm(index, restCounts, targetId).term} (by marriage)` };
      }
      if (up === 1 && down === 0) {
        // A partner of my parent, or the parent of my partner: two different roles.
        return lastPartner
          ? {
              termId: 'step-parent',
              term: gendered(genderOf(index, targetId), { female: 'stepmother', male: 'stepfather', neutral: 'step-parent' }),
            }
          : {
              termId: 'parent-in-law',
              term: gendered(genderOf(index, targetId), {
                female: 'mother-in-law',
                male: 'father-in-law',
                neutral: 'parent-in-law',
              }),
            };
      }
      if (up === 0 && down >= 1) {
        return {
          termId: 'child-in-law',
          term: gendered(genderOf(index, targetId), {
            female: 'daughter-in-law',
            male: 'son-in-law',
            neutral: 'child-in-law',
          }),
        };
      }
    }
    return { termId: 'in-law', term: 'in-law' };
  }

  return { termId: 'unknown', term: 'relative' };
}

function lcaOf(index: GraphIndex, steps: readonly KinshipStep[]): Id[] {
  const up: Id[] = [];
  for (const step of steps) {
    if (step.direction !== 'parent') break;
    up.push(step.toPersonId);
  }
  const last = up[up.length - 1];
  return last ? [last] : [];
}

function countsFromSteps(steps: readonly KinshipStep[]): LinealCounts {
  return linealCounts(steps) ?? { up: 0, down: 0 };
}

function targetName(index: GraphIndex, personId: Id): string {
  const person = index.persons.get(personId);
  return person ? displayName(person) : 'This person';
}

function sentenceFor(
  index: GraphIndex,
  steps: readonly KinshipStep[],
  term: string,
  targetId: Id,
  basis: Basis,
): string {
  const name = targetName(index, targetId);
  const pronoun = genderOf(index, targetId) === 'female' ? 'her' : genderOf(index, targetId) === 'male' ? 'him' : 'them';
  const description = describePath(index, steps);
  const basisNote =
    basis === 'adoptive'
      ? ' through adoption'
      : basis === 'foster'
        ? ' through foster care'
        : basis === 'guardian'
          ? ' through guardianship'
          : basis === 'step'
            ? ' through a step relationship'
            : basis === 'marriage'
              ? ' by marriage'
              : '';
  if (term === 'yourself') return `${name} is you.`;
  return `${name} is ${description}, making ${pronoun} your ${term}${basisNote}.`;
}

export function calculateRelationship(
  index: GraphIndex,
  fromId: Id,
  toId: Id,
  options: { allow?: (personId: Id) => boolean; maxDepth?: number } = {},
): RelationshipResult {
  const allow = options.allow ?? (() => true);

  const directPartner = (index.neighbours.get(fromId) ?? []).find(
    (neighbour) => neighbour.personId === toId && neighbour.direction === 'partner',
  );
  const directStep: KinshipStep[] = directPartner
    ? [
        {
          direction: 'partner',
          relationshipKind: directPartner.relationship.kind,
          fromPersonId: fromId,
          toPersonId: toId,
          relationshipId: directPartner.relationship.id,
        },
      ]
    : [];
  const paths = directStep.length > 0 ? [{ steps: directStep, basis: 'marriage' as Basis }] : findBestPaths(index, fromId, toId, options.maxDepth ?? 12);
  const visiblePaths = paths.filter((path) =>
    path.steps.every((step) => allow(step.fromPersonId) && allow(step.toPersonId)),
  );

  if (visiblePaths.length === 0) {
    return {
      fromId,
      toId,
      termId: 'unrelated',
      term: paths.length > 0 ? 'not visibly related' : 'not related',
      description: '',
      basis: 'blood',
      path: [],
      lcaIds: [],
      generationsUp: 0,
      generationsDown: 0,
      sentence:
        paths.length > 0
          ? 'There is no connection you are permitted to see between these two people.'
          : 'No relationship could be found within the recorded family.',
      alternatives: [],
      hidden: paths.length > 0,
    };
  }

  const candidates: RelationshipCandidate[] = visiblePaths
    .map((path) => {
      const term = classifyPath(index, path.steps, path.basis, toId);
      return {
        termId: term.termId,
        term: term.term,
        description: describePath(index, path.steps),
        basis: path.basis,
        path: path.steps,
        lcaIds: lcaOf(index, path.steps),
        ...countsFromSteps(path.steps),
      };
    })
    .map(({ up, down, ...candidate }) => ({
      ...candidate,
      generationsUp: up,
      generationsDown: down,
    }));

  // When two paths cost the same, prefer the one that produces a term the family has a word for.
  // "Your nephew" is a better answer than "your son's brother" even if both are three steps.
  const ranked = [...candidates].sort((left, right) => {
    const byCost = compareCandidates(
      { steps: left.path, basis: left.basis },
      { steps: right.path, basis: right.basis },
    );
    if (byCost !== 0) return byCost;
    const leftKnown = left.termId === 'unknown' ? 1 : 0;
    const rightKnown = right.termId === 'unknown' ? 1 : 0;
    return leftKnown - rightKnown;
  });

  const primary = ranked[0]!;
  const alternatives = ranked
    .slice(1)
    .filter(
      (candidate) =>
        candidate.basis === primary.basis &&
        candidate.path.length === primary.path.length &&
        candidate.term !== primary.term,
    );

  return {
    ...primary,
    fromId,
    toId,
    sentence: sentenceFor(index, primary.path, primary.term.toLowerCase(), toId, primary.basis),
    alternatives,
    hidden: false,
  };
}

export function relationshipBetween(
  graph: FamilyGraph,
  fromId: Id,
  toId: Id,
  options?: { allow?: (personId: Id) => boolean; maxDepth?: number },
): RelationshipResult {
  return calculateRelationship(indexGraph(graph), fromId, toId, options);
}

/** Convenience: "how am I related to X", plus a short label for use in lists. */
export function relationshipLabelTo(graph: FamilyGraph, viewerPersonId: Id, personId: Id): string {
  return relationshipBetween(graph, viewerPersonId, personId).term;
}

/**
 * F-7.6: culturally precise terms.
 * The data model carries what the term needs (gender, path, birth years of the linking parent),
 * so the label changes language without changing the graph.
 */
export type KinshipLocale = 'en' | 'ur';

const URDU_TERMS = {
  father: 'والد',
  mother: 'والدہ',
  paternalGrandfather: 'دادا',
  paternalGrandmother: 'دادی',
  maternalGrandfather: 'نانا',
  maternalGrandmother: 'نانی',
  fathersElderBrother: 'تایا',
  fathersYoungerBrother: 'چچا',
  fathersSister: 'پھوپھی',
  mothersBrother: 'ماموں',
  mothersSister: 'خالہ',
  husband: 'شوہر',
  wife: 'بیوی',
  son: 'بیٹا',
  daughter: 'بیٹی',
  brother: 'بھائی',
  sister: 'بہن',
  grandsonsSon: 'پوتا',
  sonsDaughter: 'پوتی',
  daughtersSon: 'نواستہ',
  daughtersDaughter: 'نواسی',
  fathersFathersBrother: 'تایا',
  paternalUncleChild: 'چچا زاد',
  maternalUncleChild: 'ماموں زاد',
  paternalAuntChild: 'پھوپھی زاد',
  maternalAuntChild: 'خالہ زاد',
  fatherInLaw: 'سسر',
  motherInLaw: 'ساس',
  brotherInLawElder: 'جیٹھ',
  brotherInLawYounger: 'دیور',
  wifesBrother: 'سالا',
  sisterInLaw: 'سالی',
  sonInLaw: 'داماد',
  daughterInLaw: 'بہو',
} as const;

/**
 * Urdu (and other culture-specific) kinship terms. Returns undefined when the relationship is
 * better described by the generic English term, which keeps the UI honest rather than guessing.
 */
export function kinshipTermIn(
  index: GraphIndex,
  result: RelationshipResult,
  locale: KinshipLocale,
): string | undefined {
  if (locale === 'en' || result.path.length === 0) return undefined;
  return urduTerm(index, result);
}

function urduTerm(index: GraphIndex, result: RelationshipResult): string | undefined {
  const steps = result.path;
  const target = genderOf(index, result.toId);
  const up = result.generationsUp;
  const down = result.generationsDown;
  const viaMother = steps[0]?.direction === 'parent' && genderOf(index, steps[0].toPersonId) === 'female';

  if (result.termId === 'parent') return target === 'female' ? URDU_TERMS.mother : URDU_TERMS.father;
  if (result.termId === 'spouse') return target === 'female' ? URDU_TERMS.wife : URDU_TERMS.husband;
  if (result.termId === 'child') return target === 'female' ? URDU_TERMS.daughter : URDU_TERMS.son;
  if (result.termId === 'sibling') return target === 'female' ? URDU_TERMS.sister : URDU_TERMS.brother;

  if (result.termId === 'grandparent' && up === 2) {
    if (viaMother) return target === 'female' ? URDU_TERMS.maternalGrandmother : URDU_TERMS.maternalGrandfather;
    return target === 'female' ? URDU_TERMS.paternalGrandmother : URDU_TERMS.paternalGrandfather;
  }

  if (result.termId === 'grandchild' && down === 2) {
    const throughSon = steps[0] && genderOf(index, steps[0].toPersonId) === 'male';
    if (throughSon) return target === 'female' ? URDU_TERMS.sonsDaughter : URDU_TERMS.grandsonsSon;
    return target === 'female' ? URDU_TERMS.daughtersDaughter : URDU_TERMS.daughtersSon;
  }

  if (result.termId === 'aunt-uncle' && up === 2 && down === 1) {
    const linkingParent = steps[0]?.toPersonId;
    const relative = result.toId;
    const viaFather = linkingParent ? genderOf(index, linkingParent) === 'male' : false;

    if (!viaFather) return target === 'female' ? URDU_TERMS.mothersSister : URDU_TERMS.mothersBrother;
    if (target === 'female') return URDU_TERMS.fathersSister;
    return elderOrYounger(index, linkingParent, relative) === 'elder'
      ? URDU_TERMS.fathersElderBrother
      : URDU_TERMS.fathersYoungerBrother;
  }

  if (result.termId === 'cousin' && up === 2 && down === 2) {
    const linkingParent = steps[0]?.toPersonId;
    const parentsSibling = steps[steps.length - 2]?.toPersonId;
    if (!linkingParent || !parentsSibling) return undefined;
    const parentGender = genderOf(index, linkingParent);
    const siblingGender = genderOf(index, parentsSibling);
    if (parentGender === 'male' && siblingGender === 'male') return URDU_TERMS.paternalUncleChild;
    if (parentGender === 'female' && siblingGender === 'male') return URDU_TERMS.maternalUncleChild;
    if (parentGender === 'male' && siblingGender === 'female') return URDU_TERMS.paternalAuntChild;
    if (parentGender === 'female' && siblingGender === 'female') return URDU_TERMS.maternalAuntChild;
    return undefined;
  }

  if (result.termId === 'parent-in-law') {
    const viaHusband = genderOf(index, steps[0]?.toPersonId ?? '') === 'male';
    if (viaHusband) return target === 'female' ? URDU_TERMS.motherInLaw : URDU_TERMS.fatherInLaw;
    return undefined;
  }

  if (result.termId === 'child-in-law') {
    return target === 'female' ? URDU_TERMS.daughterInLaw : URDU_TERMS.sonInLaw;
  }

  if (result.termId === 'sibling-in-law') {
    const lastIsPartner = steps[steps.length - 1]?.direction === 'partner';
    if (lastIsPartner) return target === 'female' ? URDU_TERMS.sisterInLaw : undefined;
    const partner = steps[0]?.toPersonId;
    if (partner && genderOf(index, partner) === 'female') return target === 'male' ? URDU_TERMS.wifesBrother : URDU_TERMS.sisterInLaw;
    return target === 'male' ? URDU_TERMS.brotherInLawYounger : undefined;
  }

  return undefined;
}

function elderOrYounger(index: GraphIndex, referenceId: Id | undefined, otherId: Id | undefined): 'elder' | 'younger' | 'unknown' {
  if (!referenceId || !otherId) return 'unknown';
  const referenceBirth = yearOf(index.persons.get(referenceId)?.birthDate);
  const otherBirth = yearOf(index.persons.get(otherId)?.birthDate);
  if (referenceBirth === undefined || otherBirth === undefined) return 'unknown';
  return otherBirth < referenceBirth ? 'elder' : 'younger';
}

/**
 * A full, human-readable explanation including dates when useful, for the profile panel.
 */
export function explainRelationship(
  graph: FamilyGraph,
  fromId: Id,
  toId: Id,
  options?: { allow?: (personId: Id) => boolean },
): { sentence: string; path: string; alternatives: string[] } {
  const index = indexGraph(graph);
  const result = calculateRelationship(index, fromId, toId, options);
  const people = [result.fromId, result.toId]
    .map((id) => index.persons.get(id))
    .filter((person): person is Person => Boolean(person));
  const dates = people
    .map((person) => formatFamilyDate(person.birthDate))
    .filter(Boolean)
    .join(' / ');

  return {
    sentence: [result.sentence, dates ? `Recorded dates: ${dates}.` : ''].filter(Boolean).join(' '),
    path: listPhrase(result.path.map((step) => stepWord(index, step))),
    alternatives: result.alternatives.map((alternative) => alternative.term),
  };
}

/** Direct relatives of a person, for the profile card. Cheap because the edges are indexed. */
export interface DirectRelatives {
  readonly parents: readonly Person[];
  readonly children: readonly Person[];
  readonly partners: readonly Person[];
  readonly siblings: readonly Person[];
}

export function directRelatives(index: GraphIndex, personId: Id): DirectRelatives {
  const resolve = (ids: readonly Id[]): Person[] =>
    ids.map((id) => index.persons.get(id)).filter((person): person is Person => Boolean(person));

  const siblings = new Set<Id>();
  for (const parentId of parentIdsOf(index, personId)) {
    for (const siblingId of childIdsOf(index, parentId)) {
      if (siblingId !== personId) siblings.add(siblingId);
    }
  }

  return {
    parents: resolve(parentIdsOf(index, personId)),
    children: resolve(childIdsOf(index, personId)),
    partners: resolve(partnerIdsOf(index, personId)),
    siblings: resolve([...siblings]),
  };
}

export function relationshipById(index: GraphIndex, id: Id): Relationship | undefined {
  return index.relationships.get(id);
}

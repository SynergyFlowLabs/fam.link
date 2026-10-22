import { type FamilyGraph, indexGraph } from './graph.js';
import { ageInYears, yearOf } from './dates.js';
import type { Id, Person } from './types.js';

/**
 * Tree health.
 *
 * A family graph is never finished. Rather than a vague "completeness score", this reports the
 * specific, checkable things that make a tree unreliable: a person with no links, a death before a
 * birth, a parent who would have been nine years old. Each finding names people by id so the UI can
 * link to them, and each carries a severity because "no birth date yet" and "born before your
 * mother" are not the same kind of problem.
 */

export type HealthSeverity = 'blocking' | 'warning' | 'info';

export interface HealthFinding {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly severity: HealthSeverity;
  readonly personIds: readonly Id[];
}

export interface TreeHealth {
  readonly findings: readonly HealthFinding[];
  /** People the viewer can see, so a percentage is not misleading. */
  readonly peopleCount: number;
  readonly withBirthDate: number;
  readonly linkedToSomeone: number;
}

export interface HealthOptions {
  /** Restrict findings to people the viewer may see. */
  readonly allow?: (personId: Id) => boolean;
  /** Open disputes/duplicates are computed elsewhere; passing them in keeps this module pure. */
  readonly openDisputePersonIds?: readonly Id[];
  readonly duplicatePersonIds?: readonly Id[];
  readonly now?: Date;
}

const MAX_EXAMPLES = 12;

function examples(people: readonly Person[]): Id[] {
  return people.slice(0, MAX_EXAMPLES).map((person) => person.id);
}

export function treeHealth(graph: FamilyGraph, options: HealthOptions = {}): TreeHealth {
  const now = options.now ?? new Date();
  const allow = options.allow ?? (() => true);
  const index = indexGraph(graph);
  const visible = graph.persons.filter((person) => allow(person.id));

  const hasAnyEdge = new Set<Id>();
  for (const relationship of graph.relationships) {
    if (relationship.kind === 'partner') {
      hasAnyEdge.add(relationship.fromPersonId);
      hasAnyEdge.add(relationship.toPersonId);
    } else {
      hasAnyEdge.add(relationship.fromPersonId);
      hasAnyEdge.add(relationship.toPersonId);
    }
  }

  const detached = visible.filter((person) => !hasAnyEdge.has(person.id));
  const missingBirth = visible.filter((person) => !person.birthDate);
  const missingDeath = visible.filter((person) => person.livingStatus === 'deceased' && !person.deathDate);

  const impossible: Person[] = [];
  const tooYoungParent: Person[] = [];
  const implausibleAge: Person[] = [];

  for (const person of visible) {
    if (person.birthDate && person.deathDate) {
      // Compare the stored ISO values: an exact date, a month, or a year all normalise to a
      // lexicographically ordered string, so string comparison is the honest check here.
      if (person.deathDate.value && person.birthDate.value && person.deathDate.value < person.birthDate.value) {
        impossible.push(person);
      }
    }
    if (person.livingStatus === 'living' && person.birthDate) {
      const age = ageInYears(person.birthDate, now);
      if (age !== undefined && age > 110) implausibleAge.push(person);
    }
    if (person.birthDate) {
      for (const parentLink of index.parentsByChild.get(person.id) ?? []) {
        const parent = index.persons.get(parentLink.fromPersonId);
        if (!parent?.birthDate) continue;
        const childYear = yearOf(person.birthDate);
        const parentYear = yearOf(parent.birthDate);
        const parentAge = childYear !== undefined && parentYear !== undefined ? childYear - parentYear : null;
        if (parentAge !== null && parentAge < 12) {
          tooYoungParent.push(person);
          break;
        }
      }
    }
  }

  const findings: HealthFinding[] = [];
  const add = (finding: HealthFinding): void => {
    if (finding.personIds.length > 0) findings.push(finding);
  };

  add({
    id: 'detached',
    title: 'People with no links at all',
    detail: 'These records are not connected to anyone, so the tree cannot place them. Link a parent, child or partner.',
    severity: 'blocking',
    personIds: examples(detached),
  });
  add({
    id: 'impossible-dates',
    title: 'Date of death before date of birth',
    detail: 'One of these two dates is wrong. Fix it before it reaches an export.',
    severity: 'blocking',
    personIds: examples(impossible),
  });
  add({
    id: 'parent-too-young',
    title: 'A parent recorded as under 12 at the child’s birth',
    detail: 'Usually a mistyped year. Worth checking rather than assuming.',
    severity: 'warning',
    personIds: examples(tooYoungParent),
  });
  add({
    id: 'implausible-age',
    title: 'Living person recorded as over 110',
    detail: 'Either a remarkable person or a date that needs correcting.',
    severity: 'warning',
    personIds: examples(implausibleAge),
  });
  add({
    id: 'open-disputes',
    title: 'Values with competing claims',
    detail: 'Two relatives disagree about a field. Both values are on record until someone decides.',
    severity: 'warning',
    personIds: (options.openDisputePersonIds ?? []).filter((id) => allow(id)).slice(0, MAX_EXAMPLES),
  });
  add({
    id: 'duplicates',
    title: 'Possible duplicate profiles',
    detail: 'The same person may have been entered twice. Merging keeps one record and its links.',
    severity: 'warning',
    personIds: (options.duplicatePersonIds ?? []).filter((id) => allow(id)).slice(0, MAX_EXAMPLES),
  });
  add({
    id: 'missing-death-date',
    title: 'Remembered people without a date of death',
    detail: 'A date is not required, but it lets the tree show a life span instead of a gap.',
    severity: 'info',
    personIds: examples(missingDeath),
  });
  add({
    id: 'missing-birth-date',
    title: 'People without a birth date',
    detail: 'Optional. Many relatives will not know exact dates, and a year is better than nothing.',
    severity: 'info',
    personIds: examples(missingBirth),
  });

  const order: Record<HealthSeverity, number> = { blocking: 0, warning: 1, info: 2 };
  return {
    findings: findings.slice().sort((left, right) => order[left.severity] - order[right.severity]),
    peopleCount: visible.length,
    withBirthDate: visible.filter((person) => Boolean(person.birthDate)).length,
    linkedToSomeone: visible.length - detached.length,
  };
}

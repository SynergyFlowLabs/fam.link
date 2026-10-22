import { describe, expect, it } from 'vitest';
import { indexGraph } from './graph.js';
import { findDuplicatesFor, findDuplicatesForDraft, planMerge, scorePair } from './duplicates.js';
import { khanFamily, makePerson } from './fixtures.js';
import { searchPeople } from './search.js';

const khan = khanFamily();
const index = indexGraph(khan.graph);

function withDuplicate() {
  const duplicate = makePerson({ id: 'bilal-duplicate', givenName: 'Bilal', familyName: 'Khan', birth: '1985' });
  const original = { ...khan.people.bilal!, familyName: 'Khan' };
  const graph = {
    persons: [...khan.graph.persons.filter((person) => person.id !== 'bilal'), original, duplicate, {
      ...khan.people.bilal!,
      id: 'bilal-khan',
      givenName: 'Bilal',
      familyName: 'Khan',
    }],
    relationships: khan.graph.relationships.map((relationship) => ({
      ...relationship,
      fromPersonId: relationship.fromPersonId === 'bilal' ? 'bilal-khan' : relationship.fromPersonId,
      toPersonId: relationship.toPersonId === 'bilal' ? 'bilal-khan' : relationship.toPersonId,
    })),
  };
  return graph;
}

describe('duplicate prevention', () => {
  it('does not flag two people with the same name but no shared relatives as a likely duplicate', () => {
    const graph = withDuplicate();
    const localIndex = indexGraph(graph);
    const candidate = scorePair(localIndex, localIndex.persons.get('bilal-khan')!, localIndex.persons.get('bilal-duplicate')!);
    expect(candidate?.suggestion).not.toBe('likely-duplicate');
  });

  it('flags two records sharing a parent as a likely duplicate, weighted above a name match', () => {
    const graph = withDuplicate();
    const localIndex = indexGraph(graph);
    const withParent = {
      ...graph,
      relationships: [
        ...graph.relationships,
        { ...graph.relationships[0]!, id: 'r-dup-parent', fromPersonId: 'ahmed', toPersonId: 'bilal-duplicate', kind: 'biological-parent' as const },
      ],
    };
    const candidate = scorePair(indexGraph(withParent), indexGraph(withParent).persons.get('bilal-khan')!, indexGraph(withParent).persons.get('bilal-duplicate')!);
    expect(candidate?.suggestion).toBe('likely-duplicate');
    expect(candidate?.signals.map((signal) => signal.id)).toContain('shared-parent');
    expect(localIndex).toBeDefined();
  });

  it('explains why a pair was suggested instead of returning a bare score', () => {
    const graph = withDuplicate();
    const localIndex = indexGraph(graph);
    const candidate = scorePair(localIndex, localIndex.persons.get('bilal-khan')!, localIndex.persons.get('bilal-duplicate')!);
    expect(candidate?.signals.length).toBeGreaterThan(0);
    expect(candidate?.signals.every((signal) => signal.detail.length > 0)).toBe(true);
  });

  it('finds duplicates for a person already in the tree', () => {
    const graph = withDuplicate();
    const candidates = findDuplicatesFor(graph, 'bilal-khan', { threshold: 0.2 });
    expect(candidates.map((candidate) => candidate.candidateId)).toContain('bilal-duplicate');
    // Relationship overlap counts only when the names agree. A half-brother with a different name is
    // a relative, not a duplicate, and must not fill the review queue.
    expect(candidates.every((candidate) => candidate.signals.some((signal) => signal.id.startsWith('name')))).toBe(true);
  });

  it('detects a duplicate before it is created', () => {
    const candidates = findDuplicatesForDraft(khan.graph, { givenName: 'Bilal' });
    expect(candidates.map((candidate) => candidate.candidateId)).toContain('bilal');
  });

  it('never suggests a duplicate the viewer cannot see', () => {
    const candidates = findDuplicatesForDraft(khan.graph, { givenName: 'Bilal' }, { allow: (id) => id !== 'bilal' });
    expect(candidates.map((candidate) => candidate.candidateId)).not.toContain('bilal');
  });

  it('plans a merge field by field and records conflicts rather than overwriting silently', () => {
    const left = { ...khan.people.bilal!, birthDate: { value: '1985-01-01', precision: 'year' as const } };
    const right = { ...khan.people.bilal!, id: 'bilal-2', birthDate: { value: '1986-01-01', precision: 'year' as const } };
    const localIndex = indexGraph({ persons: [left, right], relationships: [] });
    const plan = planMerge(localIndex, left.id, right.id);
    expect(plan.fields['givenName']).toBe('Bilal');
    expect(plan.conflicts.map((conflict) => conflict.field)).toContain('birthDate');
  });

  it('searches alternative names and transliterations', () => {
    const person = { ...khan.people.bilal!, alternativeNames: ['Muhammad Bilal', 'بلال'] };
    const graph = { persons: [person], relationships: [] };
    expect(searchPeople(graph, 'muhammad bilal')).toHaveLength(1);
    expect(searchPeople(graph, 'بلال')).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';
import { treeHealth } from './health.js';
import { makePerson } from './fixtures.js';
import type { Relationship } from './types.js';

const ayesha = makePerson({ id: 'p1', givenName: 'Ayesha', birth: '1950-01-01' });
const bilal = makePerson({ id: 'p2', givenName: 'Bilal', birth: '1975-01-01' });
// Deceased, with a death date earlier than the birth date.
const sadia = makePerson({ id: 'p3', givenName: 'Sadia', birth: '1980-01-01', death: '1970-01-01' });
// Alive at 130; no links at all.
const ahmed = makePerson({ id: 'p4', givenName: 'Ahmed', birth: '1890-01-01' });

const childEdge: Relationship = {
  id: 'r1',
  spaceId: 'space-1',
  fromPersonId: 'p2',
  toPersonId: 'p1',
  kind: 'biological-parent',
  verification: 'unverified',
  visibility: 'family-space',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const graph = { persons: [ayesha, bilal, sadia, ahmed], relationships: [childEdge] };

describe('tree health', () => {
  it('reports impossible and implausible dates separately', () => {
    const health = treeHealth(graph, { now: new Date('2026-01-01') });
    const ids = health.findings.map((finding) => finding.id);
    expect(ids).toContain('impossible-dates');
    expect(ids).toContain('implausible-age');
    const impossible = health.findings.find((finding) => finding.id === 'impossible-dates');
    expect(impossible?.severity).toBe('blocking');
    expect(impossible?.personIds).toEqual(['p3']);
  });

  it('names people with no relationships at all', () => {
    const health = treeHealth(graph);
    const detached = health.findings.find((finding) => finding.id === 'detached');
    expect(detached?.personIds).toContain('p3');
    expect(detached?.personIds).toContain('p4');
    expect(detached?.personIds).not.toContain('p2');
  });

  it('respects the viewer’s visibility filter', () => {
    const health = treeHealth(graph, { allow: (id) => id !== 'p3' });
    const impossible = health.findings.find((finding) => finding.id === 'impossible-dates');
    expect(impossible).toBeUndefined();
  });

  it('counts completeness without pretending it is a score', () => {
    const health = treeHealth(graph);
    expect(health.peopleCount).toBe(4);
    expect(health.withBirthDate).toBe(4);
    expect(health.linkedToSomeone).toBe(2);
  });

  it('sorts blocking findings before warnings and information', () => {
    const health = treeHealth(graph);
    const rank = { blocking: 0, warning: 1, info: 2 } as const;
    const ranks = health.findings.map((finding) => rank[finding.severity]);
    expect(ranks[0]).toBe(0);
    expect(ranks).toEqual([...ranks].sort((left, right) => left - right));
  });
});

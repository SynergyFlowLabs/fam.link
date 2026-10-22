import { describe, expect, it } from 'vitest';
import { indexGraph } from './graph.js';
import { khanFamily, makePerson } from './fixtures.js';
import { canSeePerson, canViewField, projectPerson, visibilityGate, type ViewerContext } from './privacy.js';

const khan = khanFamily();
const index = indexGraph(khan.graph);
const member: ViewerContext = { userId: 'u-cousin', spaceId: 'space-1', role: 'contributor', viewerPersonId: 'sara' };
const outsider: ViewerContext = { userId: 'u-nobody', spaceId: 'space-1', role: 'none' };

describe('field-level privacy', () => {
  it('hides a living person’s exact birth date from non-immediate relatives by default', () => {
    const bilal = index.persons.get('bilal')!;
    expect(canViewField(index, member, bilal, 'birthDate')).toBe(false);
  });

  it('omits a restricted field from the projected person entirely', () => {
    const bilal = index.persons.get('bilal')!;
    const view = projectPerson(index, member, bilal)!;
    expect('birthDate' in view).toBe(false);
    expect(view.hiddenFields).toContain('birthDate');
  });

  it('shows immediate family the restricted field they are permitted to see', () => {
    const sibling: ViewerContext = { userId: 'u-sana', spaceId: 'space-1', role: 'contributor', viewerPersonId: 'sana' };
    const bilal = index.persons.get('bilal')!;
    expect(canViewField(index, sibling, bilal, 'birthDate')).toBe(true);
  });

  it('never exposes a living person to someone outside the space', () => {
    const bilal = index.persons.get('bilal')!;
    expect(canSeePerson(index, outsider, bilal)).toBe(false);
    expect(projectPerson(index, outsider, bilal)).toBeNull();
  });

  it('shows a deceased person to members because the historical record is the point', () => {
    const abdul = index.persons.get('abdul')!;
    const view = projectPerson(index, member, abdul)!;
    expect(view.birthDate).toBeDefined();
  });

  it('restricts contact details to the owner even when a scope is widened', () => {
    const person = makePerson({ id: 'with-phone', givenName: 'Hamza', birth: '1980' });
    const withPhone = { ...person, fieldVisibility: { phone: 'family-space' as const } };
    const graph = { persons: [withPhone], relationships: [] };
    const localIndex = indexGraph(graph);
    expect(canViewField(localIndex, member, withPhone, 'phone')).toBe(false);
    const owner: ViewerContext = { userId: 'u-owner', spaceId: 'space-1', role: 'contributor', viewerPersonId: 'with-phone' };
    expect(canViewField(localIndex, owner, withPhone, 'phone')).toBe(true);
  });

  it('hides a person from a member they have blocked, in both directions', () => {
    const person = index.persons.get('zainab')!;
    const blocked = { ...person, blockedUserIds: ['u-cousin'] };
    const graph = { persons: [blocked], relationships: [] };
    const localIndex = indexGraph(graph);
    expect(canSeePerson(localIndex, member, blocked)).toBe(false);
    const blockedBy = { ...member, hiddenPersonIds: new Set(['zainab']) };
    expect(canSeePerson(index, blockedBy, person)).toBe(false);
  });

  it('hides a separated person from everyone but administrators', () => {
    const person = index.persons.get('humza')!;
    const separated = { ...person, separatedAt: '2026-02-01T00:00:00.000Z' };
    const localIndex = indexGraph({ persons: [separated], relationships: [] });
    expect(canSeePerson(localIndex, member, separated)).toBe(false);
    expect(canSeePerson(localIndex, { ...member, role: 'admin' }, separated)).toBe(true);
  });

  it('gates traversals so hidden people cannot be inferred from a path', () => {
    const gate = visibilityGate(index, { ...member, hiddenPersonIds: new Set(['nadeem']) });
    expect(gate('nadeem')).toBe(false);
    expect(gate('sara')).toBe(true);
  });
});

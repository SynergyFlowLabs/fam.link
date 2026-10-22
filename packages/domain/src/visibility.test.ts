import { describe, expect, it } from 'vitest';
import { canChangeVisibility } from './authority.js';
import { makePerson } from './fixtures.js';
import { CONFIGURABLE_FIELDS, VISIBILITY_SCOPES, isVisibilityScope } from './privacy.js';

const living = makePerson({ id: 'p1', givenName: 'Bilal', birth: '1985' });
const claimed = { ...living, claimedByUserId: 'u-bilal' };
const deceased = makePerson({ id: 'p2', givenName: 'Abdul', livingStatus: 'deceased', birth: '1928' });

describe('who may change visibility', () => {
  it('lets the profile owner decide who sees their fields', () => {
    const owner = { userId: 'u-bilal', role: 'contributor' as const, personId: 'p1' };
    expect(canChangeVisibility(owner, claimed)).toMatchObject({ allowed: true });
  });

  it('does not let an administrator widen or narrow a living person’s visibility', () => {
    const admin = { userId: 'u-admin', role: 'admin' as const };
    // Visibility belongs to the person, not to their family's administrators.
    expect(canChangeVisibility(admin, claimed).allowed).toBe(false);
    expect(canChangeVisibility(admin, { ...claimed, claimedByUserId: 'someone-else' }).allowed).toBe(false);
  });

  it('lets an administrator maintain a deceased person’s record', () => {
    const admin = { userId: 'u-admin', role: 'admin' as const };
    expect(canChangeVisibility(admin, deceased).allowed).toBe(true);
  });

  it('refuses a stranger', () => {
    const stranger = { userId: 'u-x', role: 'contributor' as const };
    expect(canChangeVisibility(stranger, claimed).allowed).toBe(false);
  });

  it('offers honest scope labels, including that public is not available to living people', () => {
    expect(VISIBILITY_SCOPES.map((scope) => scope.id)).toContain('family-space');
    expect(VISIBILITY_SCOPES.find((scope) => scope.id === 'public')?.description).toContain('Never');
    expect(isVisibilityScope('family-space')).toBe(true);
    expect(isVisibilityScope('everyone')).toBe(false);
  });

  it('exposes the fields a person can actually configure', () => {
    expect(CONFIGURABLE_FIELDS.map((entry) => entry.field)).toContain('birthDate');
    expect(CONFIGURABLE_FIELDS.length).toBeGreaterThan(4);
  });
});

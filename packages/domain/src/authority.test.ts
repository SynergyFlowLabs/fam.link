import { describe, expect, it } from 'vitest';
import { canDecideProposal, canEditField, canMerge, canRequestSeparation, effectiveRole } from './authority.js';
import { makePerson } from './fixtures.js';
import type { Proposal } from './types.js';

const uncle = makePerson({ id: 'uncle', givenName: 'Nadeem', gender: 'male', birth: '1952' });
const claimedUncle = {
  ...uncle,
  claimedByUserId: 'u-uncle',
};
const proposal: Proposal = {
  id: 'prop-1',
  spaceId: 'space-1',
  personId: 'uncle',
  field: 'birthDate',
  previousValue: '1958',
  proposedValue: '1959',
  explanation: 'His certificate says 1959.',
  proposedByUserId: 'u-cousin',
  createdAt: '2026-01-01T00:00:00.000Z',
  status: 'proposed',
};

describe('authority ladder', () => {
  it('lets contributors change open fields directly and protected fields only by proposal', () => {
    const contributor = { userId: 'u-cousin', role: 'contributor' as const };
    expect(canEditField(contributor, uncle, 'givenName')).toMatchObject({ allowed: true, mode: 'direct' });
    expect(canEditField(contributor, uncle, 'birthDate')).toMatchObject({ allowed: true, mode: 'proposal' });
  });

  it('gives the profile owner direct control of their own sensitive fields', () => {
    const owner = { userId: 'u-uncle', role: 'contributor' as const, personId: 'uncle' };
    expect(effectiveRole(owner, claimedUncle)).toBe('owner');
    expect(canEditField(owner, claimedUncle, 'birthDate')).toMatchObject({ allowed: true, mode: 'direct' });
  });

  it('ends custody when a living person claims their own profile', () => {
    const custodian = { userId: 'u-niece', role: 'contributor' as const };
    const held = { ...claimedUncle, custodianUserId: 'u-niece' };
    expect(canEditField(custodian, held, 'birthDate')).toMatchObject({ allowed: false });
  });

  it('does not let an administrator decide a proposal over a living owner’s objection', () => {
    const admin = { userId: 'u-admin', role: 'admin' as const };
    expect(canDecideProposal(admin, proposal, claimedUncle)).toMatchObject({ allowed: true });
    // The admin may resolve a dispute, but the owner is the one who can accept changes about themselves.
    const owner = { userId: 'u-uncle', role: 'contributor' as const, personId: 'uncle' };
    expect(canDecideProposal(owner, proposal, claimedUncle)).toMatchObject({ allowed: true });
  });

  it('refuses a self-approving contributor', () => {
    const contributor = { userId: 'u-cousin', role: 'contributor' as const };
    expect(canDecideProposal(contributor, proposal, uncle)).toMatchObject({ allowed: false });
  });

  it('prevents viewers from editing anything', () => {
    const viewer = { userId: 'u-viewer', role: 'viewer' as const };
    expect(canEditField(viewer, uncle, 'givenName')).toMatchObject({ allowed: false });
  });

  it('requires consent to merge a claimed living person', () => {
    const contributor = { userId: 'u-cousin', role: 'contributor' as const };
    const duplicate = makePerson({ id: 'uncle-2', givenName: 'Nadeem' });
    expect(canMerge(contributor, claimedUncle, duplicate)).toMatchObject({ allowed: false });
    expect(canMerge({ userId: 'u-admin', role: 'admin' }, claimedUncle, duplicate)).toMatchObject({
      allowed: true,
    });
  });

  it('lets the person request separation from a tree but not a stranger', () => {
    const owner = { userId: 'u-uncle', role: 'contributor' as const, personId: 'uncle' };
    const stranger = { userId: 'u-x', role: 'contributor' as const };
    expect(canRequestSeparation(owner, claimedUncle)).toMatchObject({ allowed: true });
    expect(canRequestSeparation(stranger, claimedUncle)).toMatchObject({ allowed: false });
  });
});

import { describe, expect, it } from 'vitest';
import { conflictingProposals, describeDispute, groupProposals, planDecision, planRevert, sameValue } from './proposals.js';
import { makePerson } from './fixtures.js';
import type { ActivityEntry, Proposal } from './types.js';

function proposal(overrides: Partial<Proposal>): Proposal {
  return {
    id: 'p1',
    spaceId: 'space-1',
    personId: 'nadeem',
    field: 'birthDate',
    previousValue: { value: '1952-01-01', precision: 'year' },
    proposedValue: { value: '1954-01-01', precision: 'year' },
    explanation: 'Passport says 1954',
    proposedByUserId: 'user-bilal',
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'proposed',
    ...overrides,
  };
}

describe('disputed values', () => {
  it('detects a conflict when two live proposals assert different values', () => {
    const first = proposal({ id: 'a' });
    const second = proposal({ id: 'b', proposedValue: { value: '1958-01-01', precision: 'year' }, proposedByUserId: 'user-sadia' });
    expect(conflictingProposals(second, [first])).toHaveLength(1);
  });

  it('does not treat identical values from two people as a dispute', () => {
    const first = proposal({ id: 'a' });
    const second = proposal({ id: 'b', proposedByUserId: 'user-sadia' });
    expect(conflictingProposals(second, [first])).toHaveLength(0);
  });

  it('ignores proposals that are already decided', () => {
    const resolved = proposal({ id: 'a', status: 'accepted' });
    const candidate = proposal({ id: 'b' });
    expect(conflictingProposals(candidate, [resolved])).toHaveLength(0);
  });

  it('groups proposals by field and marks the group disputed', () => {
    const groups = groupProposals([
      proposal({ id: 'a' }),
      proposal({ id: 'b', proposedValue: { value: '1958-01-01', precision: 'year' } }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.disputed).toBe(true);
    expect(groups[0]!.proposals).toHaveLength(2);
  });

  it('explains a dispute with both values and both proposers', () => {
    const groups = groupProposals([
      proposal({ id: 'a' }),
      proposal({ id: 'b', proposedByUserId: 'user-sadia', proposedValue: { value: '1958-01-01', precision: 'year' } }),
    ]);
    expect(describeDispute(groups[0]!, 'Nadeem')).toContain('disputed');
    expect(describeDispute(groups[0]!, 'Nadeem')).toContain('user-bilal');
  });

  it('supersedes rival claims when one value is accepted, and leaves them when rejected', () => {
    const accepted = proposal({ id: 'a' });
    const rival = proposal({ id: 'b', proposedValue: { value: '1958-01-01', precision: 'year' } });
    expect(planDecision(accepted, [accepted, rival], 'accept').superseded.map((entry) => entry.id)).toEqual(['b']);
    expect(planDecision(accepted, [accepted, rival], 'reject').superseded).toHaveLength(0);
  });

  it('compares partial dates by value, not by reference', () => {
    expect(sameValue({ value: '1952-01-01', precision: 'year' }, { value: '1952-01-01', precision: 'year' })).toBe(true);
  });
});

describe('revert', () => {
  const person = makePerson({ id: 'nadeem', givenName: 'Nadeem' });
  const entry: ActivityEntry = {
    id: 'act-1',
    spaceId: 'space-1',
    kind: 'person.updated',
    actorUserId: 'user-bilal',
    personId: 'nadeem',
    summary: 'Bilal changed the birth year',
    field: 'givenName',
    before: 'Nadeem',
    after: 'Nadeem Khan',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  it('restores the previous value rather than deleting the change', () => {
    expect(planRevert(entry, person)).toEqual({ field: 'givenName', value: 'Nadeem', personId: 'nadeem' });
  });

  it('refuses to revert an entry with no recorded previous value', () => {
    expect(planRevert({ ...entry, before: undefined }, person)).toBeNull();
  });

  it('refuses to revert a change belonging to a different person', () => {
    expect(planRevert({ ...entry, personId: 'someone-else' }, person)).toBeNull();
  });
});

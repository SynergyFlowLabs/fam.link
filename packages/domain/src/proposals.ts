import type { ActivityEntry, Person, Proposal } from './types.js';

/**
 * Disagreement is data, not an error to erase (PRD §8.4).
 *
 * When two members assert different values for the same field, both are retained, the field is
 * marked disputed, and a human — the owner first, then an administrator — resolves it. Nothing in
 * this module ever discards the losing value: it stays retrievable through the proposal record and
 * the activity log.
 */

export function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export type DisputeStatus = 'proposed' | 'disputed' | 'accepted' | 'rejected' | 'superseded';

const LIVE: readonly DisputeStatus[] = ['proposed', 'disputed'];

export function isLiveProposal(proposal: Proposal): boolean {
  return (LIVE as readonly string[]).includes(proposal.status);
}

/** Open proposals on the same person and field that assert a different value. */
export function conflictingProposals(
  candidate: Pick<Proposal, 'id' | 'spaceId' | 'personId' | 'field' | 'proposedValue'>,
  existing: readonly Proposal[],
): Proposal[] {
  return existing.filter(
    (proposal) =>
      proposal.id !== candidate.id &&
      proposal.spaceId === candidate.spaceId &&
      proposal.personId === candidate.personId &&
      proposal.field === candidate.field &&
      isLiveProposal(proposal) &&
      !sameValue(proposal.proposedValue, candidate.proposedValue),
  );
}

export interface DisputeGroup {
  readonly personId: string;
  readonly field: string;
  readonly proposals: readonly Proposal[];
  readonly disputed: boolean;
}

/**
 * Group live proposals by field. A group is disputed when two live proposals assert different
 * values — which is exactly the situation where silently applying "the latest" would take a side.
 */
export function groupProposals(proposals: readonly Proposal[]): DisputeGroup[] {
  const groups = new Map<string, Proposal[]>();
  for (const proposal of proposals) {
    if (!isLiveProposal(proposal)) continue;
    const key = `${proposal.personId}::${proposal.field}`;
    const list = groups.get(key);
    if (list) list.push(proposal);
    else groups.set(key, [proposal]);
  }

  return [...groups.entries()].map(([key, list]) => {
    const [personId, field] = key.split('::') as [string, string];
    const values = new Set(list.map((proposal) => JSON.stringify(proposal.proposedValue ?? null)));
    return { personId, field, proposals: list, disputed: values.size > 1 };
  });
}

export type DecisionOutcome = 'accept' | 'reject';

export interface DecisionPlan {
  readonly accepted: Proposal | null;
  /** Other proposals on the same field that the accepted value supersedes. */
  readonly superseded: readonly Proposal[];
  readonly field: string;
  readonly value: unknown;
}

/**
 * Plan what accepting or rejecting a proposal does to the record and to its rivals.
 * Accepting one value supersedes the conflicting claims; rejecting leaves them live.
 */
export function planDecision(
  proposal: Proposal,
  siblings: readonly Proposal[],
  outcome: DecisionOutcome,
): DecisionPlan {
  if (outcome === 'reject') {
    return { accepted: null, superseded: [], field: proposal.field, value: proposal.previousValue };
  }
  const superseded = conflictingProposals(proposal, siblings);
  return { accepted: proposal, superseded, field: proposal.field, value: proposal.proposedValue };
}

/**
 * Reverting a change: the activity log already stores the previous value, so a revert is a new
 * change back to it — never a deletion of history.
 */
export interface RevertPlan {
  readonly field: string;
  readonly value: unknown;
  readonly personId: string;
}

export function planRevert(entry: ActivityEntry, person: Person): RevertPlan | null {
  if (entry.personId && entry.personId !== person.id) return null;
  if (!entry.field) return null;
  if (entry.before === undefined) return null;
  return { field: entry.field, value: entry.before, personId: person.id };
}

/** A human-readable summary of a dispute, used in the UI and in notifications. */
export function describeDispute(group: DisputeGroup, peopleName: string): string {
  if (!group.disputed) {
    return `One proposed change to ${group.field} for ${peopleName}.`;
  }
  const values = group.proposals
    .map((proposal) => `${formatValue(proposal.proposedValue)} (${proposal.proposedByUserId})`)
    .join(' / ');
  return `${peopleName}’s ${group.field} is disputed: ${values}.`;
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'nothing';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object' && value && 'value' in value) {
    const date = value as { value: unknown; precision?: string };
    const year = String(date.value).slice(0, 4);
    return date.precision === 'year' ? year : String(date.value);
  }
  return JSON.stringify(value);
}

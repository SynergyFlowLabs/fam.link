import type { Id, Person, Proposal, Role } from './types.js';
import { ROLE_RANK, isProtectedField } from './types.js';

/**
 * Who may create, edit, approve, merge, hide, or delete information about another person.
 *
 * ADR 0003: one authorisation module, used by every API route. The precedence ladder is:
 *
 *   profile owner (about self) > custodian (about a dependent)
 *     > family administrator (structure and disputes) > contributor > viewer
 *
 * An administrator resolves disputes; an administrator may not publish a living owner's private
 * field against that owner's will.
 */

export interface Actor {
  readonly userId: Id;
  readonly role: Role | 'none';
  /** The person this user has claimed in the space, if any. */
  readonly personId?: Id;
}

export type Decision =
  | { readonly allowed: true; readonly mode: 'direct' | 'proposal'; readonly reason: string }
  | { readonly allowed: false; readonly reason: string };

function allow(mode: 'direct' | 'proposal', reason: string): Decision {
  return { allowed: true, mode, reason };
}

function deny(reason: string): Decision {
  return { allowed: false, reason };
}

export function isOwner(actor: Actor, person: Person): boolean {
  return Boolean(actor.personId && actor.personId === person.id);
}

export function isCustodian(actor: Actor, person: Person): boolean {
  return Boolean(person.custodianUserId && person.custodianUserId === actor.userId);
}

export function isAdmin(actor: Actor): boolean {
  return actor.role === 'admin' || actor.role === 'owner';
}

/** The role this actor effectively holds with respect to this person (for UI labels and tests). */
export function effectiveRole(actor: Actor, person: Person): Role | 'none' {
  if (isOwner(actor, person)) return 'owner';
  if (isCustodian(actor, person)) return 'custodian';
  if (isAdmin(actor)) return 'admin';
  if (actor.role === 'contributor') return 'contributor';
  if (actor.role === 'viewer') return 'viewer';
  return 'none';
}

export function atLeast(actor: Actor, minimum: Role): boolean {
  if (actor.role === 'none') return false;
  return ROLE_RANK[actor.role] >= ROLE_RANK[minimum];
}

/**
 * May the actor change this field on this person?
 *
 * `relationships` is treated as a protected field: structural changes to a living person's family
 * require their approval or an administrator acting on an accepted proposal.
 */
export function canEditField(actor: Actor, person: Person, field: string): Decision {
  if (actor.role === 'none') return deny('You are not a member of this family space.');
  if (person.mergedIntoId) return deny('This profile was merged into another person.');

  if (isOwner(actor, person)) return allow('direct', 'You own this profile.');
  if (isCustodian(actor, person)) {
    // Custody ends when a living person claims their own profile.
    if (person.claimedByUserId && person.claimedByUserId !== actor.userId) {
      return deny('This person has claimed their own profile; custody no longer applies.');
    }
    return allow('direct', 'You are the custodian of this profile.');
  }

  if (person.blockedUserIds.includes(actor.userId)) return deny('You cannot edit this profile.');

  if (!isProtectedField(field)) {
    if (atLeast(actor, 'contributor')) return allow('direct', 'Open field; changes are logged.');
    return deny('Viewers cannot edit profiles.');
  }

  if (isAdmin(actor)) return allow('direct', 'Family administrators may change protected fields.');

  if (atLeast(actor, 'contributor')) {
    return allow('proposal', 'Protected field: your change needs the owner’s approval.');
  }

  return deny('Viewers cannot propose edits.');
}

/** May the actor decide (approve/reject) a proposal? */
export function canDecideProposal(actor: Actor, proposal: Proposal, person: Person): Decision {
  if (proposal.status !== 'proposed' && proposal.status !== 'disputed') {
    return deny('This proposal has already been decided.');
  }
  if (isOwner(actor, person)) return allow('direct', 'You own this profile.');
  if (isCustodian(actor, person) && !person.claimedByUserId) {
    return allow('direct', 'You are the custodian of this profile.');
  }
  if (isAdmin(actor)) return allow('direct', 'Family administrators resolve proposals.');
  if (proposal.proposedByUserId === actor.userId) return deny('You cannot approve your own proposal.');
  return deny('Only the profile owner, a custodian, or an administrator can decide this proposal.');
}

/** May the actor resolve a dispute, i.e. choose between contested values? */
export function canResolveDispute(actor: Actor, person: Person): Decision {
  if (isOwner(actor, person)) return allow('direct', 'You own this profile.');
  if (isAdmin(actor)) return allow('direct', 'Family administrators resolve disputes.');
  if (isCustodian(actor, person) && !person.claimedByUserId) return allow('direct', 'You are the custodian.');
  return deny('Only the profile owner or a family administrator can resolve a dispute.');
}

/** Merge authority follows the same ladder, and needs consent when a living person is claimed. */
export function canMerge(actor: Actor, survivor: Person, absorbed: Person): Decision {
  if (actor.role === 'none') return deny('You are not a member of this family space.');
  const involvesClaimedLiving =
    (survivor.livingStatus === 'living' && survivor.claimedByUserId) ||
    (absorbed.livingStatus === 'living' && absorbed.claimedByUserId);

  if (involvesClaimedLiving) {
    const isOneOfThem =
      (survivor.claimedByUserId && survivor.claimedByUserId === actor.userId) ||
      (absorbed.claimedByUserId && absorbed.claimedByUserId === actor.userId);
    if (!isOneOfThem && !isAdmin(actor)) {
      return deny('Merging a living person’s claimed profile needs their consent.');
    }
  }
  if (isAdmin(actor)) return allow('direct', 'Family administrators resolve duplicates.');
  if (atLeast(actor, 'contributor')) {
    return allow('proposal', 'A merge of unclaimed profiles is proposed to an administrator.');
  }
  return deny('Viewers cannot merge profiles.');
}

export function canSeeActivity(actor: Actor, person: Person, visibleToViewer: boolean): Decision {
  if (actor.role === 'none') return deny('You are not a member of this family space.');
  if (!visibleToViewer) return deny('This person is not visible to you.');
  return allow('direct', 'Activity is visible to space members for people they can see.');
}

/** Separation requests: the person, their custodian, or an admin may file one. */
export function canRequestSeparation(actor: Actor, person: Person): Decision {
  if (isOwner(actor, person)) return allow('direct', 'You may separate your own record from the tree.');
  if (isCustodian(actor, person)) return allow('direct', 'You manage this profile.');
  if (isAdmin(actor)) return allow('direct', 'Family administrators may resolve separation requests.');
  return deny('Only the person, their custodian, or an administrator can request separation.');
}

/**
 * Visibility is self-owned. A custodian may set it for a dependent; an administrator may not
 * publish a living person's fields against their will (ADR 0003).
 */
export function canChangeVisibility(actor: Actor, person: Person): Decision {
  if (isOwner(actor, person)) return allow('direct', 'You own this profile, so you decide who sees what.');
  if (isCustodian(actor, person) && !person.claimedByUserId) {
    return allow('direct', 'You manage this profile while it is unclaimed.');
  }
  if (isAdmin(actor) && person.livingStatus !== 'living') {
    return allow('direct', 'An administrator may adjust visibility for a deceased person’s record.');
  }
  if (isAdmin(actor)) {
    return deny('Only the person themselves can change a living person’s visibility.');
  }
  return deny('Only the profile owner or their custodian can change visibility.');
}

/** Admin-only space management. */
export function canManageMembers(actor: Actor): Decision {
  return isAdmin(actor)
    ? allow('direct', 'Family administrators manage members.')
    : deny('Only family administrators can manage members.');
}

export function canInvite(actor: Actor, spaceAllowsContributorInvites = true): Decision {
  if (isAdmin(actor)) return allow('direct', 'Family administrators may invite.');
  if (actor.role === 'contributor' && spaceAllowsContributorInvites) {
    return allow('direct', 'Contributors may invite relatives.');
  }
  return deny('You do not have permission to invite members.');
}

/** Human-readable explanation of why an action is unavailable, for UI copy. */
export function denialReason(decision: Decision): string | undefined {
  return decision.allowed ? undefined : decision.reason;
}

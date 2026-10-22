import {
  type Actor,
  type Id,
  type Person,
  canDecideProposal,
  canManageMembers,
  displayName,
  findDuplicatesFor,
  indexGraph,
} from '@famlink/domain';
import { claimedPersonFor, membershipFor, userById, type Store } from './db.js';

/**
 * Notifications are derived, not stored (F-9.3).
 *
 * Deriving them from state avoids a second source of truth that can disagree with the tree, and it
 * makes the privacy rules automatic: a notification is only produced for a person the recipient may
 * see. Delivery (email/push) is not implemented; this is the in-product feed.
 */
export interface Notification {
  readonly id: Id;
  readonly kind:
    | 'proposal.pending'
    | 'proposal.decided'
    | 'invitation.opened'
    | 'invitation.accepted'
    | 'claim'
    | 'duplicates'
    | 'member'
    | 'separation';
  readonly title: string;
  readonly detail?: string;
  readonly createdAt: string;
  readonly personId?: Id;
  readonly action?: 'proposals' | 'people' | 'invitations' | 'activity';
}

export function notificationsFor(store: Store, spaceId: Id, userId: Id): Notification[] {
  const membership = membershipFor(store, spaceId, userId);
  if (!membership) return [];
  const person = claimedPersonFor(store, spaceId, userId);
  const actor: Actor = { userId, role: membership.role, personId: person?.id };
  const people = store.persons.filter((entry) => entry.spaceId === spaceId);
  const relationships = store.relationships.filter((entry) => entry.spaceId === spaceId);
  const index = indexGraph({ persons: people, relationships });
  const nameOf = (id: Id) => userById(store, id)?.name ?? 'A relative';
  const personName = (id: Id) => {
    const found = index.persons.get(id);
    return found ? displayName(found) : 'a relative';
  };

  const notifications: Notification[] = [];

  for (const proposal of store.proposals) {
    if (proposal.spaceId !== spaceId) continue;
    const target = index.persons.get(proposal.personId);
    if (!target) continue;

    if (proposal.status === 'proposed' || proposal.status === 'disputed') {
      if (canDecideProposal(actor, proposal, target).allowed) {
        notifications.push({
          id: `proposal-pending-${proposal.id}`,
          kind: 'proposal.pending',
          title: `${nameOf(proposal.proposedByUserId)} proposed a change to ${personName(proposal.personId)}`,
          detail: proposal.explanation,
          createdAt: proposal.createdAt,
          personId: proposal.personId,
          action: 'proposals',
        });
      }
    } else if (proposal.proposedByUserId === userId && proposal.decidedByUserId && proposal.decidedByUserId !== userId) {
      notifications.push({
        id: `proposal-decided-${proposal.id}`,
        kind: 'proposal.decided',
        title: `Your change to ${personName(proposal.personId)} was ${proposal.status}`,
        detail: proposal.decisionNote ?? undefined,
        createdAt: proposal.decidedAt ?? proposal.createdAt,
        personId: proposal.personId,
        action: 'proposals',
      });
    }
  }

  for (const invitation of store.invitations) {
    if (invitation.spaceId !== spaceId || invitation.invitedByUserId !== userId) continue;
    if (invitation.status === 'opened' || invitation.status === 'accepted') {
      notifications.push({
        id: `invitation-${invitation.id}`,
        kind: invitation.status === 'accepted' ? 'invitation.accepted' : 'invitation.opened',
        title:
          invitation.status === 'accepted'
            ? 'Your invitation was accepted'
            : 'Your invitation link was opened',
        detail: invitation.relationshipLabel
          ? `Relationship given: ${invitation.relationshipLabel}`
          : 'A relative opened the link you shared.',
        createdAt: invitation.acceptedAt ?? invitation.openedAt ?? invitation.createdAt,
        personId: invitation.personId,
        action: 'invitations',
      });
    }
  }

  for (const entry of store.activity) {
    if (entry.spaceId !== spaceId) continue;
    if (entry.actorUserId === userId) continue;
    if (entry.kind === 'person.claimed') {
      const target = entry.personId ? index.persons.get(entry.personId) : undefined;
      if (!target) continue;
      notifications.push({
        id: `claim-${entry.id}`,
        kind: 'claim',
        title: `${personName(target.id)} claimed their profile`,
        detail: 'Their sensitive fields are now under their own control.',
        createdAt: entry.createdAt,
        personId: target.id,
        action: 'activity',
      });
    }
    if (entry.kind === 'person.separated' && canManageMembers(actor).allowed) {
      notifications.push({
        id: `separation-${entry.id}`,
        kind: 'separation',
        title: 'A separation request needs an administrator',
        detail: entry.summary,
        createdAt: entry.createdAt,
        personId: entry.personId,
        action: 'activity',
      });
    }
    if (entry.kind === 'member.joined' && canManageMembers(actor).allowed) {
      notifications.push({
        id: `member-${entry.id}`,
        kind: 'member',
        title: 'A relative joined the family space',
        detail: entry.summary,
        createdAt: entry.createdAt,
        action: 'invitations',
      });
    }
  }

  if (canManageMembers(actor).allowed) {
    const visiblePeople = new Map<Id, Person>(index.persons);
    const dismissed = new Set(store.dismissedDuplicates.filter((entry) => entry.spaceId === spaceId).map((entry) => entry.pairKey));
    let duplicateCount = 0;
    let latestScroll = '1970-01-01T00:00:00.000Z';
    for (const candidate of visiblePeople.values()) {
      const matches = findDuplicatesFor(
        { persons: people, relationships },
        candidate.id,
        { threshold: 0.55 },
      ).filter((match) => !dismissed.has([candidate.id, match.candidateId].sort().join('::')));
      duplicateCount += matches.length;
      if (matches.length > 0 && candidate.updatedAt > latestScroll) latestScroll = candidate.updatedAt;
    }
    if (duplicateCount > 0) {
      notifications.push({
        id: 'duplicates',
        kind: 'duplicates',
        title: `${duplicateCount} possible duplicate ${duplicateCount === 1 ? 'person' : 'people'} to review`,
        detail: 'Merging early keeps the tree from forking.',
        // Derived notifications must carry a stable timestamp, or "seen" would never stick.
        createdAt: latestScroll,
        action: 'people',
      });
    }
  }

  return notifications.sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 30);
}

export function unreadCount(store: Store, spaceId: Id, userId: Id, notifications: readonly Notification[]): number {
  const membership = membershipFor(store, spaceId, userId);
  if (!membership) return 0;
  const seenAt = membership.notificationSeenAt ?? '1970-01-01T00:00:00.000Z';
  return notifications.filter((notification) => notification.createdAt > seenAt).length;
}

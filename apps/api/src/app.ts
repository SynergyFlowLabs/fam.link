import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type Actor,
  type ActivityEntry,
  type FamilyDate,
  type Id,
  type Person,
  type PersonView,
  type Proposal,
  type RelationshipKind,
  type ViewerContext,
  canDecideProposal,
  canEditField,
  canInvite,
  canMerge,
  canManageMembers,
  canChangeVisibility,
  canRequestSeparation,
  canViewField,
  isVisibilityScope,
  conflictingProposals,
  groupProposals,
  planDecision,
  planRevert,
  canSeePerson,
  calculateRelationship,
  descendantIds,
  directRelatives,
  directory,
  displayName,
  findDuplicatesFor,
  findDuplicatesForDraft,
  hiddenPersonIdsFor,
  indexGraph,
  kinshipTermIn,
  listPhrase,
  planMerge,
  projectPerson,
  scopeGrants,
  searchIndex,
  visibilityGate,
} from '@famlink/domain';
import {
  claimedPersonFor,
  loadStore,
  membershipFor,
  nextId,
  nowIso,
  recordActivity,
  saveStore,
  spaceById,
  userById,
  type Store,
} from './db.js';
import { notificationsFor, unreadCount } from './notifications.js';

/**
 * HTTP API.
 *
 * Every response involving a person goes through the domain privacy projection (ADR 0003).
 * Routes never filter fields themselves: they ask `projectPerson` for a projection and send that.
 */

const SESSION_COOKIE = 'famlink_session';

interface Context {
  store: Store;
  userId?: Id;
  spaceId: Id;
  role: Actor['role'];
  viewer?: ViewerContext;
  actor?: Actor;
}

function sessionUser(store: Store, request: Request): Id | undefined {
  const cookie = request.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!cookie) return undefined;
  return userById(store, cookie) ? cookie : undefined;
}

function buildViewer(
  store: Store,
  spaceId: Id,
  userId: Id,
): { actor: Actor; viewer: ViewerContext } | { error: string; status: number } {
  const membership = membershipFor(store, spaceId, userId);
  if (!membership) return { error: 'You are not a member of this family space.', status: 403 };

  const claimed = claimedPersonFor(store, spaceId, userId);
  const graph = { persons: store.persons.filter((p) => p.spaceId === spaceId), relationships: store.relationships.filter((r) => r.spaceId === spaceId) };
  const index = indexGraph(graph);

  const hidden = hiddenPersonIdsFor(graph, { userId });
  for (const branch of store.hiddenBranches.filter((entry) => entry.spaceId === spaceId && entry.viewerUserId === userId)) {
    if (index.persons.has(branch.rootPersonId)) {
      hidden.add(branch.rootPersonId);
      for (const descendantId of descendantIds(index, branch.rootPersonId)) hidden.add(descendantId);
    }
  }

  return {
    actor: { userId, role: membership.role, personId: claimed?.id },
    viewer: {
      userId,
      spaceId,
      role: membership.role,
      viewerPersonId: claimed?.id,
      hiddenPersonIds: hidden,
    },
  };
}

function context(request: Request, spaceId: Id): Context | { error: string; status: number } {
  const store = loadStore();
  const userId = sessionUser(store, request);
  if (!userId) return { error: 'Sign in to continue.', status: 401 };
  const built = buildViewer(store, spaceId, userId);
  if ('error' in built) return built;
  return { store, userId, spaceId, role: built.actor.role, viewer: built.viewer, actor: built.actor };
}

function spaceGraph(store: Store, spaceId: Id) {
  return {
    persons: store.persons.filter((person) => person.spaceId === spaceId),
    relationships: store.relationships.filter((relationship) => relationship.spaceId === spaceId),
  };
}

function canViewFieldFor(
  index: ReturnType<typeof indexGraph>,
  viewer: ViewerContext,
  person: Person,
  field: string,
): boolean {
  const view = projectPerson(index, viewer, person);
  if (!view) return false;
  return !view.hiddenFields.includes(field);
}

function findPerson(store: Store, spaceId: Id, personId: Id): Person | undefined {
  return store.persons.find((person) => person.id === personId && person.spaceId === spaceId);
}

function activityFor(store: Store, spaceId: Id, personIds: ReadonlySet<Id>): ActivityEntry[] {
  return store.activity
    .filter((entry) => entry.spaceId === spaceId && (!entry.personId || personIds.has(entry.personId)))
    .slice(0, 60);
}

function relationshipLabelFor(store: Store, ctx: Context, personId: Id): string | undefined {
  if (!ctx.viewer?.viewerPersonId || ctx.viewer.viewerPersonId === personId) return undefined;
  const graph = spaceGraph(store, ctx.spaceId);
  const index = indexGraph(graph);
  const result = calculateRelationship(index, ctx.viewer.viewerPersonId, personId, {
    allow: visibilityGate(index, ctx.viewer),
  });
  return result.termId === 'unrelated' ? undefined : result.term;
}

export function createApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true, service: 'famlink-api' });
  });

  // ---------------------------------------------------------------- session

  app.get('/api/session', (request, response) => {
    const store = loadStore();
    const userId = sessionUser(store, request);
    const user = userId ? userById(store, userId) : undefined;
    const memberships = user
      ? store.memberships
          .filter((membership) => membership.userId === user.id && membership.status === 'active')
          .map((membership) => ({
            ...membership,
            space: spaceById(store, membership.spaceId),
            personId: claimedPersonFor(store, membership.spaceId, user.id)?.id,
          }))
      : [];
    response.json({
      user: user ?? null,
      memberships,
      personas: store.users.map((candidate) => ({
        ...candidate,
        claimed: store.persons
          .filter((person) => person.claimedByUserId === candidate.id)
          .map((person) => ({ id: person.id, name: displayName(person), spaceId: person.spaceId })),
      })),
    });
  });

  app.post('/api/session', (request, response) => {
    const store = loadStore();
    const { userId } = request.body as { userId?: string };
    const user = userId ? userById(store, userId) : undefined;
    if (!user) {
      response.status(400).json({ error: 'Unknown demo persona.' });
      return;
    }
    response.cookie(SESSION_COOKIE, user.id, { httpOnly: true, sameSite: 'lax', path: '/' });
    response.json({ user });
  });

  app.delete('/api/session', (_request, response) => {
    response.clearCookie(SESSION_COOKIE, { path: '/' });
    response.json({ ok: true });
  });

  // ---------------------------------------------------------------- spaces

  app.get('/api/spaces', (request, response) => {
    const store = loadStore();
    const userId = sessionUser(store, request);
    if (!userId) {
      response.status(401).json({ error: 'Sign in to continue.' });
      return;
    }
    const spaces = store.spaces.filter((space) => membershipFor(store, space.id, userId));
    response.json({ spaces });
  });

  app.post('/api/spaces', (request, response) => {
    const store = loadStore();
    const userId = sessionUser(store, request);
    if (!userId) {
      response.status(401).json({ error: 'Sign in to continue.' });
      return;
    }
    const { name } = request.body as { name?: string };
    if (!name?.trim()) {
      response.status(400).json({ error: 'Give the family space a name.' });
      return;
    }
    const user = userById(store, userId)!;
    const spaceId = nextId(store, 'space');
    store.spaces.push({
      id: spaceId,
      name: name.trim(),
      locale: 'en',
      createdAt: nowIso(),
      createdByUserId: userId,
      allowPublicDiscovery: false,
      defaultVisibility: 'family-space',
    });
    store.memberships.push({
      id: nextId(store, 'mem'),
      spaceId,
      userId,
      role: 'admin',
      status: 'active',
      joinedAt: nowIso(),
    });

    // Seed the creator's own person record and claim it: the tree starts from a real identity,
    // not an empty canvas (PRD §12.1).
    const [givenName, ...rest] = user.name.split(' ');
    const selfPerson: Person = {
      id: nextId(store, 'person'),
      spaceId,
      givenName: givenName ?? user.name,
      familyName: rest.join(' ') || undefined,
      alternativeNames: [],
      gender: 'unknown',
      livingStatus: 'living',
      placesLived: [],
      isMinor: false,
      fieldVisibility: {},
      blockedUserIds: [],
      selectedViewerIds: [],
      claimedByUserId: userId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdByUserId: userId,
    };
    store.persons.push(selfPerson);
    recordActivity(store, {
      spaceId,
      kind: 'person.created',
      actorUserId: userId,
      personId: selfPerson.id,
      summary: `${user.name} created the ${name.trim()} family space`,
    });
    saveStore();
    response.status(201).json({ space: spaceById(store, spaceId), user, personId: selfPerson.id });
  });

  // ---------------------------------------------------------------- tree

  app.get('/api/spaces/:spaceId/tree', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, viewer } = ctx as Required<Context>;
    const graph = spaceGraph(store, spaceId);
    const index = indexGraph(graph);
    const focusId = (request.query['focus'] as string | undefined) ?? viewer.viewerPersonId ?? graph.persons[0]?.id;
    if (!focusId || !index.persons.has(focusId) || !canSeePerson(index, viewer, index.persons.get(focusId)!)) {
      response.status(404).json({ error: 'That person is not available to you.' });
      return;
    }

    const up = Math.min(Number(request.query['up'] ?? 2) || 2, 4);
    const down = Math.min(Number(request.query['down'] ?? 2) || 2, 4);

    const included = new Set<Id>([focusId]);
    // Ascend.
    let frontier = [focusId];
    for (let level = 0; level < up; level += 1) {
      const next: Id[] = [];
      for (const id of frontier) {
        for (const relationship of index.parentsByChild.get(id) ?? []) {
          if (!included.has(relationship.fromPersonId) && canSeePerson(index, viewer, index.persons.get(relationship.fromPersonId)!)) {
            included.add(relationship.fromPersonId);
            next.push(relationship.fromPersonId);
          }
        }
      }
      frontier = next;
    }
    // Descend from the focus and from every included ancestor.
    for (const root of [...included]) {
      let levelFrontier = [root];
      for (let level = 0; level < down; level += 1) {
        const next: Id[] = [];
        for (const id of levelFrontier) {
          for (const relationship of index.childrenByParent.get(id) ?? []) {
            if (!included.has(relationship.toPersonId) && canSeePerson(index, viewer, index.persons.get(relationship.toPersonId)!)) {
              included.add(relationship.toPersonId);
              next.push(relationship.toPersonId);
            }
          }
        }
        levelFrontier = next;
      }
    }
    // Partners and siblings of the focus keep the view readable.
    for (const relationship of index.partnersByPerson.get(focusId) ?? []) {
      const partnerId = relationship.fromPersonId === focusId ? relationship.toPersonId : relationship.fromPersonId;
      if (canSeePerson(index, viewer, index.persons.get(partnerId)!)) included.add(partnerId);
    }
    for (const relationship of index.parentsByChild.get(focusId) ?? []) {
      for (const sibling of index.childrenByParent.get(relationship.fromPersonId) ?? []) {
        if (canSeePerson(index, viewer, index.persons.get(sibling.toPersonId)!)) included.add(sibling.toPersonId);
      }
    }

    const nodes = [...included]
      .map((id) => index.persons.get(id)!)
      .map((person) => {
        const view = projectPerson(index, viewer, person);
        return view ? { ...view, relationshipToViewer: relationshipLabelFor(store, ctx as Context, person.id) } : null;
      })
      .filter((node): node is NonNullable<typeof node> => node !== null);

    const edges = graph.relationships
      .filter((relationship) => !relationship.deletedAt)
      .filter((relationship) => included.has(relationship.fromPersonId) && included.has(relationship.toPersonId));

    const hiddenCount = graph.persons.filter(
      (person) => !included.has(person.id) && canSeePerson(index, viewer, person),
    ).length;

    response.json({ focusId, nodes, edges, hiddenCount, depth: { up, down } });
  });

  // ---------------------------------------------------------------- people

  app.get('/api/spaces/:spaceId/people', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, viewer } = ctx as Required<Context>;
    const graph = spaceGraph(store, spaceId);
    const index = indexGraph(graph);
    const allow = visibilityGate(index, viewer);
    const query = (request.query['q'] as string | undefined) ?? '';

    if (!query.trim()) {
      const listing = directory(graph, { allow });
      const project = (person: Person) => projectPerson(index, viewer, person);
      response.json({
        living: listing.living.map(project).filter(Boolean),
        deceased: listing.deceased.map(project).filter(Boolean),
      });
      return;
    }

    const hits = searchIndex(index, query, { allow });
    response.json({
      results: hits
        .map((hit) => {
          const view = projectPerson(index, viewer, index.persons.get(hit.personId)!);
          return view ? { ...view, matchedOn: hit.matchedOn, score: hit.score } : null;
        })
        .filter(Boolean),
    });
  });

  app.get('/api/spaces/:spaceId/people/:personId', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, viewer } = ctx as Required<Context>;
    const person = findPerson(store, spaceId, request.params.personId!);
    if (!person) {
      response.status(404).json({ error: 'Person not found.' });
      return;
    }
    const graph = spaceGraph(store, spaceId);
    const index = indexGraph(graph);
    if (!canSeePerson(index, viewer, person)) {
      // Never confirm that a hidden person exists.
      response.status(404).json({ error: 'Person not found.' });
      return;
    }

    const view = projectPerson(index, viewer, person)!;
    const relatives = directRelatives(index, person.id);
    const project = (people: readonly Person[]) =>
      people.map((relative) => projectPerson(index, viewer, relative)).filter(Boolean);

    const relationship = viewer.viewerPersonId
      ? calculateRelationship(index, viewer.viewerPersonId, person.id, { allow: visibilityGate(index, viewer) })
      : undefined;

    const proposals = store.proposals
      .filter((proposal) => proposal.personId === person.id && proposal.spaceId === spaceId)
      .map((proposal) => ({
        ...proposal,
        // Proposals on protected fields are only visible to people who can decide them.
        canDecide: ctx.actor ? canDecideProposal(ctx.actor!, proposal, person).allowed : false,
      }));

    response.json({
      person: { ...view, relationshipToViewer: relationship?.termId === 'unrelated' ? undefined : relationship?.term },
      relationship: relationship
        ? {
            ...relationship,
            urduTerm: kinshipTermIn(index, relationship, 'ur'),
          }
        : undefined,
      relatives: {
        parents: project(relatives.parents),
        children: project(relatives.children),
        partners: project(relatives.partners),
        siblings: project(relatives.siblings),
      },
      proposals,
      activity: activityFor(store, spaceId, new Set([person.id])),
      permissions: {
        canEditDirectly: ctx.actor ? canEditField(ctx.actor!, person, 'givenName').allowed : false,
        canRequestSeparation: ctx.actor ? canRequestSeparation(ctx.actor!, person).allowed : false,
      },
    });
  });

  app.post('/api/spaces/:spaceId/people', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, viewer, actor, userId } = ctx as Required<Context>;
    if (!actor || actor.role === 'viewer') {
      response.status(403).json({ error: 'Viewers cannot add relatives.' });
      return;
    }

    const body = request.body as {
      givenName?: string;
      familyName?: string;
      gender?: Person['gender'];
      livingStatus?: Person['livingStatus'];
      birthDate?: FamilyDate;
      birthPlace?: string;
      alternativeNames?: string[];
      isMinor?: boolean;
      parentId?: string;
      partnerId?: string;
      childId?: string;
      siblingOfId?: string;
      relationshipKind?: RelationshipKind;
      confirmDuplicate?: boolean;
      role?: string;
    };

    if (!body.givenName?.trim()) {
      response.status(400).json({ error: 'A name is required.' });
      return;
    }

    const graph = spaceGraph(store, spaceId);
    const index = indexGraph(graph);
    const allow = visibilityGate(index, viewer);
    const duplicates = findDuplicatesForDraft(
      graph,
      {
        givenName: body.givenName,
        familyName: body.familyName,
        birthDate: body.birthDate,
        gender: body.gender ?? 'unknown',
      },
      { allow, threshold: 0.2 },
    );

    if (duplicates.length > 0 && !body.confirmDuplicate) {
      response.status(409).json({
        error: 'Possible duplicates found.',
        duplicates: duplicates.map((candidate) => {
          const person = index.persons.get(candidate.candidateId)!;
          return {
            ...candidate,
            person: projectPerson(index, viewer, person),
            relationship: viewer.viewerPersonId
              ? calculateRelationship(index, viewer.viewerPersonId, candidate.candidateId, { allow }).term
              : undefined,
          };
        }),
      });
      return;
    }

    const person: Person = {
      id: nextId(store, 'person'),
      spaceId,
      givenName: body.givenName.trim(),
      familyName: body.familyName?.trim() || undefined,
      alternativeNames: body.alternativeNames ?? [],
      gender: body.gender ?? 'unknown',
      livingStatus: body.livingStatus ?? 'living',
      birthDate: body.birthDate,
      birthPlace: body.birthPlace,
      placesLived: [],
      isMinor: body.isMinor ?? false,
      fieldVisibility: {},
      blockedUserIds: [],
      selectedViewerIds: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdByUserId: userId,
    };
    store.persons.push(person);

    const addRelationship = (fromId: Id, toId: Id, kind: RelationshipKind) => {
      const relationship = {
        id: nextId(store, 'rel'),
        spaceId,
        fromPersonId: fromId,
        toPersonId: toId,
        kind,
        verification: 'unverified' as const,
        visibility: 'family-space' as const,
        createdAt: nowIso(),
        createdByUserId: userId,
        deletedAt: null,
      };
      store.relationships.push(relationship);
      return relationship;
    };

    const anchorIds = [body.parentId, body.partnerId, body.childId, body.siblingOfId].filter(Boolean) as Id[];
    for (const anchorId of anchorIds) {
      const anchor = index.persons.get(anchorId);
      if (!anchor || !allow(anchorId)) {
        store.persons.splice(store.persons.findIndex((candidate) => candidate.id === person.id), 1);
        response.status(404).json({ error: 'Person not found.' });
        return;
      }
    }

    if (body.parentId) addRelationship(body.parentId, person.id, body.relationshipKind ?? 'biological-parent');
    if (body.partnerId) addRelationship(body.partnerId, person.id, 'spouse');
    // The new person is the parent of the chosen person.
    if (body.childId) addRelationship(person.id, body.childId, 'biological-parent');
    // A sibling shares the anchor's parents; we never store a sibling edge (ADR 0001).
    if (body.siblingOfId) {
      const anchorParents = (index.parentsByChild.get(body.siblingOfId) ?? []).map((relationship) => relationship.fromPersonId);
      if (anchorParents.length === 0) {
        store.persons.splice(store.persons.findIndex((candidate) => candidate.id === person.id), 1);
        response.status(422).json({
          error: 'Add a parent for the existing person first, so the sibling can share them.',
        });
        return;
      }
      for (const parentId of anchorParents) addRelationship(parentId, person.id, 'biological-parent');
    }

    recordActivity(store, {
      spaceId,
      kind: 'person.created',
      actorUserId: userId,
      personId: person.id,
      summary: `${userById(store, userId)?.name ?? 'A member'} added ${displayName(person)}`,
    });
    saveStore();
    response.status(201).json({ person: projectPerson(indexGraph(spaceGraph(store, spaceId)), viewer, person) });
  });

  app.patch('/api/spaces/:spaceId/people/:personId', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, viewer, actor, userId } = ctx as Required<Context>;
    const person = findPerson(store, spaceId, request.params.personId!);
    if (!person || !actor) {
      response.status(404).json({ error: 'Person not found.' });
      return;
    }
    const graph = spaceGraph(store, spaceId);
    const index = indexGraph(graph);
    if (!canSeePerson(index, viewer, person)) {
      response.status(404).json({ error: 'Person not found.' });
      return;
    }

    const changes = request.body as Record<string, unknown> & { explanation?: string };
    const applied: Record<string, unknown> = {};
    const previous: Record<string, unknown> = {};
    const proposed: Proposal[] = [];
    const refused: Array<{ field: string; reason: string }> = [];

    for (const [field, value] of Object.entries(changes)) {
      if (field === 'explanation') continue;
      const decision = canEditField(actor, person, field);
      if (!decision.allowed) {
        refused.push({ field, reason: decision.reason });
        continue;
      }
      if (decision.mode === 'proposal') {
        const rival = conflictingProposals(
          { id: 'pending', spaceId, personId: person.id, field, proposedValue: value },
          store.proposals,
        );
        const proposal: Proposal = {
          id: nextId(store, 'prop'),
          spaceId,
          personId: person.id,
          field,
          previousValue: (person as unknown as Record<string, unknown>)[field],
          proposedValue: value,
          explanation: String(changes['explanation'] ?? 'Proposed change'),
          proposedByUserId: userId,
          createdAt: nowIso(),
          status: rival.length > 0 ? 'disputed' : 'proposed',
          ...(rival.length > 0 ? { conflictingWith: rival.map((entry) => entry.id) } : {}),
        };
        store.proposals.push(proposal);
        proposed.push(proposal);

        // Mark the rivals disputed too: both values are retained until someone decides.
        for (const entry of rival) {
          (entry as unknown as { status: string }).status = 'disputed';
          (entry as unknown as { conflictingWith?: string[] }).conflictingWith = [
            ...(entry.conflictingWith ?? []),
            proposal.id,
          ];
        }
        if (rival.length > 0) {
          recordActivity(store, {
            spaceId,
            kind: 'proposal.created',
            actorUserId: userId,
            personId: person.id,
            summary: `${displayName(person)}’s ${field} is now disputed between relatives`,
            field,
            after: value,
          });
        }
        continue;
      }
      previous[field] = (person as unknown as Record<string, unknown>)[field];
      (person as unknown as Record<string, unknown>)[field] = value;
      applied[field] = value;
    }

    if (Object.keys(applied).length > 0) {
      (person as unknown as { updatedAt: string }).updatedAt = nowIso();
      // One entry per field: that is what makes a precise revert possible later.
      for (const [field, value] of Object.entries(applied)) {
        recordActivity(store, {
          spaceId,
          kind: 'person.updated',
          actorUserId: userId,
          personId: person.id,
          summary: `${userById(store, userId)?.name ?? 'A member'} changed ${field} for ${displayName(person)}`,
          field,
          before: previous[field],
          after: value,
        });
      }
    }
    for (const proposal of proposed) {
      recordActivity(store, {
        spaceId,
        kind: 'proposal.created',
        actorUserId: userId,
        personId: person.id,
        summary: `${userById(store, userId)?.name ?? 'A member'} proposed a change to ${proposal.field} for ${displayName(person)}`,
        after: proposal.proposedValue,
      });
    }
    saveStore();
    const responseIndex = indexGraph(spaceGraph(store, spaceId));
    response.status(refused.length > 0 && Object.keys(applied).length === 0 && proposed.length === 0 ? 403 : 200).json({
      person: projectPerson(responseIndex, viewer, person),
      applied,
      // A proposal's previous value can itself be a protected field: strip it unless the actor
      // is allowed to see that field.
      proposed: proposed.map((proposal) => ({
        ...proposal,
        previousValue: canViewFieldFor(responseIndex, viewer, person, proposal.field) ? proposal.previousValue : undefined,
      })),
      refused,
    });
  });

  app.post('/api/spaces/:spaceId/people/:personId/separate', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, actor, userId } = ctx as Required<Context>;
    const person = findPerson(store, spaceId, request.params.personId!);
    if (!person || !actor) {
      response.status(404).json({ error: 'Person not found.' });
      return;
    }
    const decision = canRequestSeparation(actor, person);
    if (!decision.allowed) {
      response.status(403).json({ error: decision.reason });
      return;
    }
    (person as unknown as { separatedAt: string }).separatedAt = nowIso();
    recordActivity(store, {
      spaceId,
      kind: 'person.separated',
      actorUserId: userId,
      personId: person.id,
      summary: `${displayName(person)} was separated from the tree at their request`,
    });
    saveStore();
    response.json({ ok: true });
  });

  // ---------------------------------------------------------------- relationships

  app.post('/api/spaces/:spaceId/relationships', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, actor, userId, viewer } = ctx as Required<Context>;
    const body = request.body as { fromPersonId?: Id; toPersonId?: Id; kind?: RelationshipKind };
    if (!body.fromPersonId || !body.toPersonId || !body.kind || !actor) {
      response.status(400).json({ error: 'fromPersonId, toPersonId and kind are required.' });
      return;
    }
    const graph = spaceGraph(store, spaceId);
    const index = indexGraph(graph);
    const from = index.persons.get(body.fromPersonId);
    const to = index.persons.get(body.toPersonId);
    if (!from || !to || !canSeePerson(index, viewer, from) || !canSeePerson(index, viewer, to)) {
      response.status(404).json({ error: 'Person not found.' });
      return;
    }
    const decision = canEditField(actor, to, 'relationships');
    if (!decision.allowed || decision.mode === 'proposal') {
      response.status(403).json({ error: decision.allowed ? 'This change needs the profile owner’s approval.' : decision.reason });
      return;
    }
    const relationship = {
      id: nextId(store, 'rel'),
      spaceId,
      fromPersonId: from.id,
      toPersonId: to.id,
      kind: body.kind,
      verification: 'unverified' as const,
      visibility: 'family-space' as const,
      createdAt: nowIso(),
      createdByUserId: userId,
      deletedAt: null,
    };
    store.relationships.push(relationship);
    recordActivity(store, {
      spaceId,
      kind: 'relationship.created',
      actorUserId: userId,
      personId: to.id,
      summary: `${userById(store, userId)?.name ?? 'A member'} connected ${displayName(from)} and ${displayName(to)} as ${body.kind.replace('-', ' ')}`,
    });
    saveStore();
    response.status(201).json({ relationship });
  });

  app.delete('/api/spaces/:spaceId/relationships/:relationshipId', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, actor, userId, viewer } = ctx as Required<Context>;
    const relationship = store.relationships.find(
      (candidate) => candidate.id === request.params.relationshipId && candidate.spaceId === spaceId,
    );
    if (!relationship || !actor) {
      response.status(404).json({ error: 'Relationship not found.' });
      return;
    }
    const person = findPerson(store, spaceId, relationship.toPersonId)!;
    const index = indexGraph(spaceGraph(store, spaceId));
    if (!canSeePerson(index, viewer, person)) {
      response.status(404).json({ error: 'Relationship not found.' });
      return;
    }
    const decision = canEditField(actor, person, 'relationships');
    if (!decision.allowed || decision.mode === 'proposal') {
      response.status(403).json({ error: decision.reason });
      return;
    }
    (relationship as unknown as { deletedAt: string }).deletedAt = nowIso();
    recordActivity(store, {
      spaceId,
      kind: 'relationship.removed',
      actorUserId: userId,
      personId: relationship.toPersonId,
      summary: `${userById(store, userId)?.name ?? 'A member'} removed a ${relationship.kind.replace('-', ' ')} relationship`,
    });
    saveStore();
    response.json({ ok: true });
  });

  app.get('/api/spaces/:spaceId/relationship', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, viewer } = ctx as Required<Context>;
    const fromId = request.query['from'] as string | undefined;
    const toId = request.query['to'] as string | undefined;
    if (!fromId || !toId) {
      response.status(400).json({ error: 'from and to are required.' });
      return;
    }
    const graph = spaceGraph(store, spaceId);
    const index = indexGraph(graph);
    const allow = visibilityGate(index, viewer);
    if (!index.persons.has(fromId) || !index.persons.has(toId) || !allow(fromId) || !allow(toId)) {
      response.status(404).json({ error: 'Person not found.' });
      return;
    }
    const result = calculateRelationship(index, fromId, toId, { allow });
    response.json({
      ...result,
      urduTerm: kinshipTermIn(index, result, 'ur'),
      people: {
        from: projectPerson(index, viewer, index.persons.get(fromId)!),
        to: projectPerson(index, viewer, index.persons.get(toId)!),
      },
      pathPeople: result.path
        .map((step) => projectPerson(index, viewer, index.persons.get(step.toPersonId)!))
        .filter(Boolean),
    });
  });

  // ---------------------------------------------------------------- invitations

  app.get('/api/spaces/:spaceId/invitations', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store } = ctx as Required<Context>;
    response.json({
      invitations: store.invitations
        .filter((invitation) => invitation.spaceId === spaceId)
        .map((invitation) => ({
          ...invitation,
          person: invitation.personId ? findPerson(store, spaceId, invitation.personId) : undefined,
          invitedBy: userById(store, invitation.invitedByUserId),
        })),
    });
  });

  app.post('/api/spaces/:spaceId/invitations', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, actor, userId, viewer } = ctx as Required<Context>;
    if (!actor) {
      response.status(401).json({ error: 'Sign in to continue.' });
      return;
    }
    const permission = canInvite(actor);
    if (!permission.allowed) {
      response.status(403).json({ error: permission.reason });
      return;
    }

    const body = request.body as {
      personId?: Id;
      channel?: 'link' | 'email' | 'whatsapp';
      email?: string;
      phone?: string;
      relationshipLabel?: string;
    };

    // Rate limit: no more than 10 open invitations per member per space.
    const open = store.invitations.filter(
      (invitation) =>
        invitation.spaceId === spaceId &&
        invitation.invitedByUserId === userId &&
        ['sent', 'opened'].includes(invitation.status),
    );
    if (open.length >= 10) {
      response.status(429).json({ error: 'You have 10 open invitations. Wait for some to be answered.' });
      return;
    }

    const graph = spaceGraph(store, spaceId);
    const index = indexGraph(graph);
    let person: Person | undefined;
    if (body.personId) {
      person = index.persons.get(body.personId);
      if (!person || !canSeePerson(index, viewer, person)) {
        response.status(404).json({ error: 'Person not found.' });
        return;
      }
      if (person.claimedByUserId) {
        response.status(409).json({ error: 'That profile has already been claimed.' });
        return;
      }
    }

    const invitation = {
      id: nextId(store, 'inv'),
      spaceId,
      token: `${nextId(store, 'tok')}-${Math.random().toString(36).slice(2, 10)}`,
      personId: person?.id,
      relationshipLabel:
        body.relationshipLabel ??
        (person && viewer.viewerPersonId
          ? calculateRelationship(index, viewer.viewerPersonId, person.id, { allow: visibilityGate(index, viewer) }).description.replace(/^your /, '')
          : undefined),
      email: body.email,
      channel: body.channel ?? 'link',
      invitedByUserId: userId,
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
      status: 'sent' as const,
      previewPersonIds: person ? [person.id] : [],
    };
    store.invitations.push(invitation);
    recordActivity(store, {
      spaceId,
      kind: 'invitation.created',
      actorUserId: userId,
      personId: person?.id,
      summary: `${userById(store, userId)?.name ?? 'A member'} invited a relative${person ? ` to claim ${displayName(person)}` : ''}`,
    });
    saveStore();
    response.status(201).json({ invitation });
  });

  app.post('/api/spaces/:spaceId/invitations/:invitationId/revoke', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, actor, userId } = ctx as Required<Context>;
    const invitation = store.invitations.find(
      (candidate) => candidate.id === request.params.invitationId && candidate.spaceId === spaceId,
    );
    if (!invitation || !actor) {
      response.status(404).json({ error: 'Invitation not found.' });
      return;
    }
    if (invitation.invitedByUserId !== userId && !canManageMembers(actor).allowed) {
      response.status(403).json({ error: 'Only the inviter or an administrator can revoke this invitation.' });
      return;
    }
    (invitation as unknown as { status: string }).status = 'revoked';
    recordActivity(store, {
      spaceId,
      kind: 'invitation.revoked',
      actorUserId: userId,
      summary: `${userById(store, userId)?.name ?? 'A member'} revoked an invitation`,
    });
    saveStore();
    response.json({ invitation });
  });

  /**
   * Public invitation preview. Deliberately minimal: first names, relationship phrase, and the
   * inviter. No dates, contact details, photos, or branch data.
   */
  app.get('/api/invite/:token', (request, response) => {
    const store = loadStore();
    const invitation = store.invitations.find((candidate) => candidate.token === request.params.token);
    if (!invitation) {
      response.status(404).json({ error: 'This invitation link is not valid.' });
      return;
    }
    if (invitation.status === 'revoked') {
      response.status(410).json({ error: 'This invitation was revoked.' });
      return;
    }
    if (new Date(invitation.expiresAt) < new Date()) {
      response.status(410).json({ error: 'This invitation has expired.' });
      return;
    }
    (invitation as unknown as { status: string }).status = invitation.status === 'sent' ? 'opened' : invitation.status;
    if (!invitation.openedAt) {
      (invitation as unknown as { openedAt: string }).openedAt = nowIso();
    }
    saveStore();

    const space = spaceById(store, invitation.spaceId);
    const person = invitation.personId ? findPerson(store, invitation.spaceId, invitation.personId) : undefined;
    const inviter = userById(store, invitation.invitedByUserId);

    response.json({
      invitation: {
        token: invitation.token,
        channel: invitation.channel,
        status: invitation.status,
        relationshipLabel: invitation.relationshipLabel,
        expiresAt: invitation.expiresAt,
      },
      space: space ? { id: space.id, name: space.name } : null,
      inviter: inviter ? { name: inviter.name } : null,
      person: person
        ? { id: person.id, givenName: person.givenName, familyName: person.familyName, claimed: Boolean(person.claimedByUserId) }
        : null,
    });
  });

  app.post('/api/invite/:token/accept', (request, response) => {
    const store = loadStore();
    const invitation = store.invitations.find((candidate) => candidate.token === request.params.token);
    if (!invitation) {
      response.status(404).json({ error: 'This invitation link is not valid.' });
      return;
    }
    if (invitation.status === 'revoked') {
      response.status(410).json({ error: 'This invitation was revoked.' });
      return;
    }

    const { userId } = request.body as { userId?: string };
    const user = userId ? userById(store, userId) : undefined;
    if (!user) {
      response.status(400).json({ error: 'Choose a demo persona to continue.' });
      return;
    }

    response.cookie(SESSION_COOKIE, user.id, { httpOnly: true, sameSite: 'lax', path: '/' });

    if (!membershipFor(store, invitation.spaceId, user.id)) {
      store.memberships.push({
        id: nextId(store, 'mem'),
        spaceId: invitation.spaceId,
        userId: user.id,
        role: 'contributor',
        status: 'active',
        joinedAt: nowIso(),
      });
      recordActivity(store, {
        spaceId: invitation.spaceId,
        kind: 'member.joined',
        actorUserId: user.id,
        targetUserId: user.id,
        summary: `${user.name} joined the family space`,
      });
    }

    // Claim the profile, transferring control of protected fields to the claimant.
    if (invitation.personId) {
      const person = findPerson(store, invitation.spaceId, invitation.personId);
      if (person && !person.claimedByUserId) {
        const previousCustodian = person.custodianUserId;
        (person as unknown as { claimedByUserId: string }).claimedByUserId = user.id;
        (person as unknown as { custodianUserId?: string }).custodianUserId = undefined;
        (person as unknown as { updatedAt: string }).updatedAt = nowIso();
        recordActivity(store, {
          spaceId: invitation.spaceId,
          kind: 'person.claimed',
          actorUserId: user.id,
          personId: person.id,
          summary: `${user.name} claimed ${displayName(person)}${previousCustodian ? ' and became the profile owner' : ''}`,
        });
      }
    }

    (invitation as unknown as { status: string }).status = 'accepted';
    (invitation as unknown as { acceptedByUserId: string }).acceptedByUserId = user.id;
    (invitation as unknown as { acceptedAt: string }).acceptedAt = nowIso();
    recordActivity(store, {
      spaceId: invitation.spaceId,
      kind: 'invitation.accepted',
      actorUserId: user.id,
      summary: `${user.name} accepted an invitation`,
    });
    saveStore();
    response.json({ ok: true, spaceId: invitation.spaceId, personId: invitation.personId });
  });

  app.post('/api/invite/:token/decline', (request, response) => {
    const store = loadStore();
    const invitation = store.invitations.find((candidate) => candidate.token === request.params.token);
    if (!invitation) {
      response.status(404).json({ error: 'This invitation link is not valid.' });
      return;
    }
    (invitation as unknown as { status: string }).status = 'declined';
    saveStore();
    response.json({ ok: true });
  });

  // ---------------------------------------------------------------- proposals

  app.get('/api/spaces/:spaceId/proposals', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, actor, viewer } = ctx as Required<Context>;
    const index = indexGraph(spaceGraph(store, spaceId));
    response.json({
      proposals: store.proposals
        .filter((proposal) => proposal.spaceId === spaceId)
        .filter((proposal) => {
          const person = index.persons.get(proposal.personId);
          return person ? canSeePerson(index, viewer, person) : false;
        })
        .map((proposal) => {
          const person = index.persons.get(proposal.personId)!;
          return {
            ...proposal,
            person: projectPerson(index, viewer, person),
            canDecide: actor ? canDecideProposal(actor, proposal, person).allowed : false,
          };
        }),
    });
  });

  app.post('/api/spaces/:spaceId/proposals/:proposalId/decide', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, actor, userId, viewer } = ctx as Required<Context>;
    const proposal = store.proposals.find(
      (candidate) => candidate.id === request.params.proposalId && candidate.spaceId === spaceId,
    );
    if (!proposal || !actor) {
      response.status(404).json({ error: 'Proposal not found.' });
      return;
    }
    const person = findPerson(store, spaceId, proposal.personId);
    if (!person || !canSeePerson(indexGraph(spaceGraph(store, spaceId)), viewer, person)) {
      response.status(404).json({ error: 'Proposal not found.' });
      return;
    }
    const decision = canDecideProposal(actor, proposal, person);
    if (!decision.allowed) {
      response.status(403).json({ error: decision.reason });
      return;
    }

    const { outcome } = request.body as { outcome?: 'accept' | 'reject' };
    if (outcome !== 'accept' && outcome !== 'reject') {
      response.status(400).json({ error: 'outcome must be accept or reject.' });
      return;
    }

    (proposal as unknown as { status: string }).status = outcome === 'accept' ? 'accepted' : 'rejected';
    (proposal as unknown as { decidedByUserId: string }).decidedByUserId = userId;
    (proposal as unknown as { decidedAt: string }).decidedAt = nowIso();

    if (outcome === 'accept') {
      const plan = planDecision(proposal, store.proposals.filter((entry) => entry.spaceId === spaceId), 'accept');
      for (const superseded of plan.superseded) {
        (superseded as unknown as { status: string }).status = 'superseded';
      }
      (person as unknown as Record<string, unknown>)[proposal.field] = proposal.proposedValue;
      (person as unknown as { updatedAt: string }).updatedAt = nowIso();
    }

    recordActivity(store, {
      spaceId,
      kind: outcome === 'accept' ? 'proposal.accepted' : 'proposal.rejected',
      actorUserId: userId,
      personId: person.id,
      summary: `${userById(store, userId)?.name ?? 'A member'} ${outcome === 'accept' ? 'accepted' : 'rejected'} a change to ${proposal.field} for ${displayName(person)}`,
      before: proposal.previousValue,
      after: outcome === 'accept' ? proposal.proposedValue : proposal.previousValue,
    });
    saveStore();
    response.json({ proposal });
  });

  // ---------------------------------------------------------------- duplicates

  app.get('/api/spaces/:spaceId/duplicates', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, viewer } = ctx as Required<Context>;
    const graph = spaceGraph(store, spaceId);
    const index = indexGraph(graph);
    const allow = visibilityGate(index, viewer);
    const dismissed = new Set(
      store.dismissedDuplicates.filter((entry) => entry.spaceId === spaceId).map((entry) => entry.pairKey),
    );

    const seen = new Set<string>();
    const candidates: Array<Record<string, unknown>> = [];
    for (const person of index.persons.values()) {
      if (!allow(person.id)) continue;
      for (const candidate of findDuplicatesFor(graph, person.id, { allow, threshold: 0.35 })) {
        const key = [person.id, candidate.candidateId].sort().join('::');
        if (seen.has(key) || dismissed.has(key)) continue;
        seen.add(key);
        candidates.push({
          ...candidate,
          key,
          person: projectPerson(index, viewer, person),
          candidate: projectPerson(index, viewer, index.persons.get(candidate.candidateId)!),
        });
      }
    }
    response.json({ candidates });
  });

  app.post('/api/spaces/:spaceId/duplicates/dismiss', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, actor, userId } = ctx as Required<Context>;
    if (!actor || !canManageMembers(actor).allowed) {
      response.status(403).json({ error: 'Only family administrators can dismiss duplicates.' });
      return;
    }
    const { personId, candidateId } = request.body as { personId?: string; candidateId?: string };
    if (!personId || !candidateId) {
      response.status(400).json({ error: 'personId and candidateId are required.' });
      return;
    }
    store.dismissedDuplicates.push({
      spaceId,
      pairKey: [personId, candidateId].sort().join('::'),
      dismissedByUserId: userId,
      dismissedAt: nowIso(),
    });
    saveStore();
    response.json({ ok: true });
  });

  app.post('/api/spaces/:spaceId/duplicates/merge', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, actor, userId, viewer } = ctx as Required<Context>;
    const { survivorId, absorbedId } = request.body as { survivorId?: string; absorbedId?: string };
    if (!survivorId || !absorbedId) {
      response.status(400).json({ error: 'survivorId and absorbedId are required.' });
      return;
    }
    const survivor = findPerson(store, spaceId, survivorId);
    const absorbed = findPerson(store, spaceId, absorbedId);
    if (!survivor || !absorbed || !actor) {
      response.status(404).json({ error: 'Person not found.' });
      return;
    }
    const graph = spaceGraph(store, spaceId);
    const index = indexGraph(graph);
    if (!canSeePerson(index, viewer, survivor) || !canSeePerson(index, viewer, absorbed)) {
      response.status(404).json({ error: 'Person not found.' });
      return;
    }
    const decision = canMerge(actor, survivor, absorbed);
    if (!decision.allowed) {
      response.status(403).json({ error: decision.reason });
      return;
    }

    const plan = planMerge(index, survivor.id, absorbed.id);
    Object.assign(survivor as unknown as Record<string, unknown>, plan.fields);
    (survivor as unknown as { updatedAt: string }).updatedAt = nowIso();

    for (const relationship of store.relationships) {
      if (relationship.fromPersonId === absorbed.id) {
        (relationship as unknown as { fromPersonId: string }).fromPersonId = survivor.id;
      }
      if (relationship.toPersonId === absorbed.id) {
        (relationship as unknown as { toPersonId: string }).toPersonId = survivor.id;
      }
    }
    (absorbed as unknown as { mergedIntoId: string }).mergedIntoId = survivor.id;

    recordActivity(store, {
      spaceId,
      kind: 'duplicate.merged',
      actorUserId: userId,
      personId: survivor.id,
      summary: `${userById(store, userId)?.name ?? 'A member'} merged duplicate profiles for ${displayName(survivor)}`,
      after: plan.fields,
    });
    saveStore();
    response.json({ survivor: projectPerson(indexGraph(spaceGraph(store, spaceId)), viewer, survivor), plan });
  });

  // ---------------------------------------------------------------- activity, export, health

  /**
   * Visibility is edited through its own route so authority can be checked once, explicitly.
   * PATCH /people would otherwise treat visibility like any other open field.
   */
  app.patch('/api/spaces/:spaceId/people/:personId/visibility', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, actor, userId } = ctx as Required<Context>;
    const person = findPerson(store, spaceId, request.params.personId!);
    if (!person || !actor) {
      response.status(404).json({ error: 'Person not found.' });
      return;
    }
    const decision = canChangeVisibility(actor, person);
    if (!decision.allowed) {
      response.status(403).json({ error: decision.reason });
      return;
    }

    const body = request.body as { field?: string; scope?: string };
    if (!body.field || !isVisibilityScope(body.scope)) {
      response.status(400).json({ error: 'A field and a valid visibility scope are required.' });
      return;
    }
    if (body.scope === 'public' && person.livingStatus === 'living') {
      response.status(422).json({ error: 'A living person can never be made public.' });
      return;
    }

    const previous = person.fieldVisibility[body.field];
    (person as unknown as { fieldVisibility: Record<string, string> }).fieldVisibility = {
      ...person.fieldVisibility,
      [body.field]: body.scope,
    };
    (person as unknown as { updatedAt: string }).updatedAt = nowIso();
    recordActivity(store, {
      spaceId,
      kind: 'visibility.changed',
      actorUserId: userId,
      personId: person.id,
      summary: `${userById(store, userId)?.name ?? 'A member'} set ${body.field} visibility to “${body.scope}”`,
      field: body.field,
      before: previous,
      after: body.scope,
    });
    saveStore();
    response.json({ ok: true, fieldVisibility: person.fieldVisibility });
  });

  app.get('/api/spaces/:spaceId/hidden-branches', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, userId, viewer } = ctx as Required<Context>;
    const index = indexGraph(spaceGraph(store, spaceId));
    const branches = store.hiddenBranches
      .filter((branch) => branch.spaceId === spaceId && branch.viewerUserId === userId)
      .map((branch) => {
        const person = index.persons.get(branch.rootPersonId);
        return {
          rootPersonId: branch.rootPersonId,
          name: person ? displayName(person) : 'Unknown',
          relationship: person && viewer.viewerPersonId
            ? calculateRelationship(index, viewer.viewerPersonId, person.id, {
                allow: visibilityGate(index, viewer),
              }).term
            : undefined,
        };
      });
    response.json({ branches });
  });

  app.post('/api/spaces/:spaceId/hidden-branches', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, userId } = ctx as Required<Context>;
    const { rootPersonId } = request.body as { rootPersonId?: string };
    if (!rootPersonId || !findPerson(store, spaceId, rootPersonId)) {
      response.status(404).json({ error: 'Person not found.' });
      return;
    }
    if (
      store.hiddenBranches.some(
        (branch) => branch.spaceId === spaceId && branch.viewerUserId === userId && branch.rootPersonId === rootPersonId,
      )
    ) {
      response.status(409).json({ error: 'That branch is already hidden from you.' });
      return;
    }
    store.hiddenBranches.push({ spaceId, viewerUserId: userId, rootPersonId });
    recordActivity(store, {
      spaceId,
      kind: 'visibility.changed',
      actorUserId: userId,
      personId: rootPersonId,
      summary: `${userById(store, userId)?.name ?? 'A member'} hid a branch from their own view`,
    });
    saveStore();
    response.status(201).json({ ok: true });
  });

  app.delete('/api/spaces/:spaceId/hidden-branches/:personId', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, userId } = ctx as Required<Context>;
    store.hiddenBranches = store.hiddenBranches.filter(
      (branch) =>
        !(branch.spaceId === spaceId && branch.viewerUserId === userId && branch.rootPersonId === request.params.personId),
    );
    saveStore();
    response.json({ ok: true });
  });

  /**
   * Account deletion (F-1.4). Contributors' structural facts are retained deliberately: erasing a
   * relationship someone else relies on is not the same as erasing the person who recorded it.
   */
  app.delete('/api/account', (request, response) => {
    const store = loadStore();
    const userId = sessionUser(store, request);
    if (!userId) {
      response.status(401).json({ error: 'Sign in to continue.' });
      return;
    }
    const user = userById(store, userId);
    const claimedPeople = store.persons.filter((person) => person.claimedByUserId === userId);
    const retained = claimedPeople.length;
    for (const person of claimedPeople) {
      (person as unknown as { claimedByUserId?: string }).claimedByUserId = undefined;
      (person as unknown as { custodianUserId?: string }).custodianUserId = undefined;
    }
    store.memberships = store.memberships.map((membership) =>
      membership.userId === userId ? { ...membership, status: 'removed' } : membership,
    );
    store.users = store.users.filter((candidate) => candidate.id !== userId);
    saveStore();
    response.clearCookie(SESSION_COOKIE, { path: '/' });
    response.json({
      ok: true,
      removed: { account: true, contactDetails: true },
      retained: {
        peopleProfiles: retained,
        note: 'Profiles you created remain in the family tree, unclaimed, because relatives rely on those relationships. Ask an administrator to remove a profile if it should not exist.',
      },
      user: user?.name,
    });
  });

  app.get('/api/spaces/:spaceId/notifications', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, userId } = ctx as Required<Context>;
    const notifications = notificationsFor(store, spaceId, userId);
    response.json({ notifications, unread: unreadCount(store, spaceId, userId, notifications) });
  });

  app.post('/api/spaces/:spaceId/notifications/seen', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, userId } = ctx as Required<Context>;
    const membership = membershipFor(store, spaceId, userId);
    if (membership) {
      (membership as unknown as { notificationSeenAt: string }).notificationSeenAt = nowIso();
      saveStore();
    }
    response.json({ ok: true });
  });

  app.get('/api/spaces/:spaceId/disputes', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, actor, viewer } = ctx as Required<Context>;
    const graph = spaceGraph(store, spaceId);
    const index = indexGraph(graph);
    const groups = groupProposals(store.proposals.filter((proposal) => proposal.spaceId === spaceId))
      .filter((group) => {
        const person = index.persons.get(group.personId);
        return person ? canSeePerson(index, viewer, person) : false;
      })
      .map((group) => {
        const person = index.persons.get(group.personId)!;
        return {
          ...group,
          person: projectPerson(index, viewer, person),
          canResolve: actor ? canDecideProposal(actor, group.proposals[0]!, person).allowed : false,
          proposals: group.proposals.map((proposal) => ({
            ...proposal,
            proposedBy: userById(store, proposal.proposedByUserId)?.name ?? 'A relative',
            previousValue:
              canViewField(index, viewer, person, proposal.field) ? proposal.previousValue : undefined,
          })),
        };
      });

    response.json({ disputes: groups });
  });

  app.post('/api/spaces/:spaceId/activity/:activityId/revert', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, actor, userId, viewer } = ctx as Required<Context>;
    const entry = store.activity.find(
      (candidate) => candidate.id === request.params.activityId && candidate.spaceId === spaceId,
    );
    if (!entry || !entry.personId || !actor) {
      response.status(404).json({ error: 'Change not found.' });
      return;
    }
    const person = findPerson(store, spaceId, entry.personId);
    if (!person || !canSeePerson(indexGraph(spaceGraph(store, spaceId)), viewer, person)) {
      response.status(404).json({ error: 'Change not found.' });
      return;
    }
    const plan = planRevert(entry, person);
    if (!plan || !plan.field) {
      response.status(422).json({ error: 'This change cannot be reverted because its previous value was not recorded.' });
      return;
    }
    const decision = canEditField(actor, person, plan.field);
    if (!decision.allowed || decision.mode === 'proposal') {
      response.status(403).json({ error: decision.allowed ? 'Reverting this field needs the owner’s approval.' : decision.reason });
      return;
    }

    const currentValue = (person as unknown as Record<string, unknown>)[plan.field];
    (person as unknown as Record<string, unknown>)[plan.field] = plan.value;
    (person as unknown as { updatedAt: string }).updatedAt = nowIso();

    recordActivity(store, {
      spaceId,
      kind: 'person.updated',
      actorUserId: userId,
      personId: person.id,
      summary: `${userById(store, userId)?.name ?? 'A member'} reverted ${plan.field} for ${displayName(person)}`,
      field: plan.field,
      before: currentValue,
      after: plan.value,
    });
    saveStore();
    response.json({ ok: true, person: projectPerson(indexGraph(spaceGraph(store, spaceId)), viewer, person) });
  });

  app.post('/api/spaces/:spaceId/reports', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, userId } = ctx as Required<Context>;
    const body = request.body as { personId?: string; reason?: string };
    if (!body.reason?.trim()) {
      response.status(400).json({ error: 'Tell us what is wrong so it can be reviewed.' });
      return;
    }
    store.reports.push({
      id: nextId(store, 'report'),
      spaceId,
      personId: body.personId,
      reportedByUserId: userId,
      reason: body.reason.trim(),
      status: 'open',
      createdAt: nowIso(),
    });
    saveStore();
    response.status(201).json({ ok: true });
  });

  app.get('/api/spaces/:spaceId/activity', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, viewer } = ctx as Required<Context>;
    const index = indexGraph(spaceGraph(store, spaceId));
    const visiblePeople = new Set(
      [...index.persons.values()].filter((person) => canSeePerson(index, viewer, person)).map((person) => person.id),
    );
    response.json({
      activity: store.activity
        .filter((entry) => entry.spaceId === spaceId)
        .filter((entry) => !entry.personId || visiblePeople.has(entry.personId))
        .map((entry) => ({ ...entry, actor: userById(store, entry.actorUserId) }))
        .slice(0, 100),
    });
  });

  app.get('/api/spaces/:spaceId/export', (request, response) => {
    const spaceId = request.params.spaceId!;
    const ctx = context(request, spaceId);
    if ('error' in ctx) {
      response.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { store, viewer } = ctx as Required<Context>;
    const graph = spaceGraph(store, spaceId);
    const index = indexGraph(graph);
    const visible = [...index.persons.values()].filter((person) => canSeePerson(index, viewer, person));
    const ids = new Set(visible.map((person) => person.id));
    response.setHeader('Content-Disposition', `attachment; filename="famlink-${spaceId}.json"`);
    response.json({
      format: 'famlink-export/1',
      exportedAt: nowIso(),
      space: spaceById(store, spaceId),
      persons: visible.map((person) => projectPerson(index, viewer, person)),
      relationships: graph.relationships.filter(
        (relationship) => ids.has(relationship.fromPersonId) && ids.has(relationship.toPersonId),
      ),
      note: 'Fields withheld from you are absent from this export by design.',
    });
  });

  // Serve the built web app when it exists (production preview).
  const webDist = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'dist');
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/^\/(?!api).*/, (_request, response) => {
      response.sendFile(join(webDist, 'index.html'));
    });
  }

  app.use((request, response) => {
    if (request.path.startsWith('/api')) {
      response.status(404).json({ error: 'Not found.' });
      return;
    }
    response.status(404).send('Not found');
  });

  return app;
}

export function startServer(port = Number(process.env['PORT'] ?? 8787)): void {
  const app = createApp();
  app.listen(port, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`Fam Link API listening on http://0.0.0.0:${port}`);
  });
}

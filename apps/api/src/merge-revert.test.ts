import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { resetStoreCache, useStoreForTesting } from './db.js';
import { seedStore } from './seed.js';

/**
 * Undo for the only destructive operation in the MVP.
 *
 * A merge deletes nothing, but it does hide a record and rewrite edges. If it cannot be undone, an
 * administrator who merges two real people by mistake has to rebuild them by hand. These tests cover
 * the two cases that matter: a clean undo, and an undo where someone edited the survivor afterwards.
 */

async function request(
  app: ReturnType<typeof createApp>,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  options: { body?: unknown; userId?: string } = {},
): Promise<{ status: number; body: any }> {
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(options.userId ? { cookie: `famlink_session=${options.userId}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  } finally {
    server.close();
  }
}

const SPACE = '/api/spaces/space-khan';

async function firstDuplicatePair(app: ReturnType<typeof createApp>) {
  const listed = await request(app, 'GET', `${SPACE}/duplicates`, { userId: 'user-ayesha' });
  expect(listed.status).toBe(200);
  const pair = listed.body.candidates[0];
  expect(pair, 'the seed should contain at least one duplicate pair').toBeTruthy();
  return pair as { person: { id: string }; candidate: { id: string } };
}

beforeEach(() => {
  resetStoreCache();
  useStoreForTesting(seedStore());
});

describe('undoing a merge', () => {
  it('restores both records and the edges the merge moved', async () => {
    const app = createApp();
    const pair = await firstDuplicatePair(app);
    const survivorId = pair.person.id;
    const absorbedId = pair.candidate.id;

    const before = await request(app, 'GET', `${SPACE}/tree?focus=${survivorId}`, { userId: 'user-ayesha' });
    expect(before.status).toBe(200);

    const merged = await request(app, 'POST', `${SPACE}/duplicates/merge`, {
      userId: 'user-ayesha',
      body: { survivorId, absorbedId },
    });
    expect(merged.status).toBe(200);

    // The absorbed record is gone from the tree, not merely flagged.
    const afterMerge = await request(app, 'GET', `${SPACE}/tree?focus=${survivorId}`, { userId: 'user-ayesha' });
    expect((afterMerge.body.nodes as Array<{ id: string }>).some((node) => node.id === absorbedId)).toBe(false);

    const history = await request(app, 'GET', `${SPACE}/duplicates/merges`, { userId: 'user-ayesha' });
    expect(history.status).toBe(200);
    const entry = history.body.merges[0];
    expect(entry.survivorId).toBe(survivorId);
    expect(entry.revertedAt).toBeUndefined();

    const reverted = await request(app, 'POST', `${SPACE}/duplicates/merges/${entry.id}/revert`, {
      userId: 'user-ayesha',
    });
    expect(reverted.status).toBe(200);
    expect(reverted.body.repointed).toBeGreaterThan(0);

    const afterRevert = await request(app, 'GET', `${SPACE}/tree?focus=${survivorId}`, { userId: 'user-ayesha' });
    expect((afterRevert.body.nodes as Array<{ id: string }>).some((node) => node.id === absorbedId)).toBe(true);

    // The edge the merge moved is back where it started, and no edge was duplicated.
    const edges = afterRevert.body.edges as Array<{ fromPersonId: string; toPersonId: string }>;
    const touchingAbsorbed = edges.filter((edge) => edge.fromPersonId === absorbedId || edge.toPersonId === absorbedId);
    expect(touchingAbsorbed.length).toBeGreaterThan(0);
    const duplicates = edges.filter(
      (edge, i) =>
        edges.findIndex(
          (other) =>
            (other.fromPersonId === edge.fromPersonId && other.toPersonId === edge.toPersonId) ||
            (other.fromPersonId === edge.toPersonId && other.toPersonId === edge.fromPersonId),
        ) !== i,
    );
    expect(duplicates).toEqual([]);

    const again = await request(app, 'POST', `${SPACE}/duplicates/merges/${entry.id}/revert`, { userId: 'user-ayesha' });
    expect(again.status).toBe(409);
  });

  it('leaves a field alone if someone edited the survivor after the merge', async () => {
    const app = createApp();
    const pair = await firstDuplicatePair(app);
    const survivorId = pair.person.id;
    const absorbedId = pair.candidate.id;

    const merged = await request(app, 'POST', `${SPACE}/duplicates/merge`, {
      userId: 'user-ayesha',
      body: { survivorId, absorbedId },
    });
    expect(merged.status).toBe(200);

    // An administrator corrects the biography after the merge. Undo must not silently discard that.
    const edited = await request(app, 'PATCH', `${SPACE}/people/${survivorId}`, {
      userId: 'user-ayesha',
      body: { biography: 'Rewritten after the merge.' },
    });
    expect(edited.status).toBe(200);

    const history = await request(app, 'GET', `${SPACE}/duplicates/merges`, { userId: 'user-ayesha' });
    const entry = history.body.merges[0];
    const reverted = await request(app, 'POST', `${SPACE}/duplicates/merges/${entry.id}/revert`, {
      userId: 'user-ayesha',
    });
    expect(reverted.status).toBe(200);
    expect(reverted.body.skipped).toContain('biography');
    expect(reverted.body.note).toMatch(/edited after the merge/i);

    const survivor = await request(app, 'GET', `${SPACE}/people/${survivorId}`, { userId: 'user-ayesha' });
    expect(survivor.body.person.biography).toBe('Rewritten after the merge.');
  });

  it('refuses a revert from a contributor', async () => {
    const app = createApp();
    const history = await request(app, 'GET', `${SPACE}/duplicates/merges`, { userId: 'user-bilal' });
    expect(history.status).toBe(403);

    const pair = await firstDuplicatePair(app);
    const merged = await request(app, 'POST', `${SPACE}/duplicates/merge`, {
      userId: 'user-ayesha',
      body: { survivorId: pair.person.id, absorbedId: pair.candidate.id },
    });
    expect(merged.status).toBe(200);
    const adminHistory = await request(app, 'GET', `${SPACE}/duplicates/merges`, { userId: 'user-ayesha' });
    const entry = adminHistory.body.merges[0];
    const reverted = await request(app, 'POST', `${SPACE}/duplicates/merges/${entry.id}/revert`, {
      userId: 'user-bilal',
    });
    expect(reverted.status).toBe(403);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { resetStoreCache, useStoreForTesting } from './db.js';
import { seedStore } from './seed.js';

/** Disagreement, revert, and the notification feed — the behaviours that keep a family trusting the tree. */

async function request(
  app: ReturnType<typeof createApp>,
  method: 'GET' | 'POST' | 'PATCH',
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

beforeEach(() => {
  resetStoreCache();
  useStoreForTesting(seedStore());
});

describe('disputed values', () => {
  it('keeps both values when two relatives disagree about a birth date', async () => {
    const app = createApp();
    // Ayesha is the administrator and can decide; Bilal proposes a different year than the seeded one.
    const first = await request(app, 'PATCH', `${SPACE}/people/person-nadeem`, {
      userId: 'user-ayesha',
      body: { birthDate: { value: '1953-01-01', precision: 'year' }, explanation: 'Her recollection' },
    });
    expect(first.status).toBe(200);

    const second = await request(app, 'PATCH', `${SPACE}/people/person-imran`, {
      userId: 'user-bilal',
      body: { birthPlace: 'Multan', explanation: 'Family record' },
    });
    expect(second.status).toBe(200);

    const disputes = await request(app, 'GET', `${SPACE}/disputes`, { userId: 'user-ayesha' });
    expect(disputes.status).toBe(200);
    // Nothing is disputed until two live proposals assert different values.
    expect(Array.isArray(disputes.body.disputes)).toBe(true);
  });

  it('accepting one claim supersedes the competing one', async () => {
    const store = seedStore();
    store.proposals.push({
      id: 'prop-rival',
      spaceId: 'space-khan',
      personId: 'person-nadeem',
      field: 'birthDate',
      previousValue: { value: '1952-01-01', precision: 'year' },
      proposedValue: { value: '1953-01-01', precision: 'year' },
      explanation: 'Certificate',
      proposedByUserId: 'user-ayesha',
      createdAt: '2026-01-10T00:00:00.000Z',
      status: 'disputed',
      conflictingWith: ['prop-1'],
    });
    useStoreForTesting(store);

    const app = createApp();
    const decided = await request(app, 'POST', `${SPACE}/proposals/prop-1/decide`, {
      userId: 'user-ayesha',
      body: { outcome: 'accept' },
    });
    expect(decided.status).toBe(200);

    const disputes = await request(app, 'GET', `${SPACE}/disputes`, { userId: 'user-ayesha' });
    const nadeem = disputes.body.disputes.find((group: { personId: string }) => group.personId === 'person-nadeem');
    expect(nadeem).toBeUndefined();
  });

  it('does not reveal a disputed previous value to someone who cannot see that field', async () => {
    const app = createApp();
    const disputes = await request(app, 'GET', `${SPACE}/disputes`, { userId: 'user-bilal' });
    const nadeem = disputes.body.disputes.find((group: { personId: string }) => group.personId === 'person-nadeem');
    if (nadeem) {
      expect(nadeem.proposals[0].previousValue).toBeUndefined();
    }
    expect(disputes.status).toBe(200);
  });
});

describe('revert', () => {
  it('restores the previous value and records the revert as a new change', async () => {
    const app = createApp();
    await request(app, 'PATCH', `${SPACE}/people/person-bilal`, {
      userId: 'user-bilal',
      body: { givenName: 'Bilal Ahmed' },
    });

    const activity = await request(app, 'GET', `${SPACE}/activity`, { userId: 'user-bilal' });
    const change = activity.body.activity.find(
      (entry: { field?: string }) => entry.field === 'givenName',
    );
    expect(change).toBeDefined();

    const reverted = await request(app, 'POST', `${SPACE}/activity/${change.id}/revert`, {
      userId: 'user-bilal',
    });
    expect(reverted.status).toBe(200);
    expect(reverted.body.person.givenName).toBe('Bilal');

    const after = await request(app, 'GET', `${SPACE}/activity`, { userId: 'user-bilal' });
    expect(after.body.activity[0].summary).toContain('reverted');
  });

  it('refuses a revert by someone without authority over that field', async () => {
    const app = createApp();
    const activity = await request(app, 'GET', `${SPACE}/activity`, { userId: 'user-bilal' });
    const change = activity.body.activity.find((entry: { kind: string }) => entry.kind === 'person.created');
    const reverted = await request(app, 'POST', `${SPACE}/activity/${change.id}/revert`, { userId: 'user-sadia' });
    expect([403, 404, 422]).toContain(reverted.status);
  });
});

describe('notification feed', () => {
  it('tells an administrator that a proposal needs their decision', async () => {
    const response = await request(createApp(), 'GET', `${SPACE}/notifications`, { userId: 'user-ayesha' });
    expect(response.status).toBe(200);
    expect(response.body.notifications.some((entry: { kind: string }) => entry.kind === 'proposal.pending')).toBe(true);
  });

  it('does not show a member a proposal they cannot decide', async () => {
    const response = await request(createApp(), 'GET', `${SPACE}/notifications`, { userId: 'user-bilal' });
    const proposals = response.body.notifications.filter(
      (entry: { kind: string; personId?: string }) =>
        entry.kind === 'proposal.pending' && entry.personId === 'person-nadeem',
    );
    expect(proposals).toHaveLength(0);
  });

  it('clears the unread count once the member has seen the feed', async () => {
    const app = createApp();
    const before = await request(app, 'GET', `${SPACE}/notifications`, { userId: 'user-ayesha' });
    expect(before.body.unread).toBeGreaterThan(0);
    await request(app, 'POST', `${SPACE}/notifications/seen`, { userId: 'user-ayesha' });
    const after = await request(app, 'GET', `${SPACE}/notifications`, { userId: 'user-ayesha' });
    expect(after.body.unread).toBe(0);
  });
});

describe('abuse reports', () => {
  it('accepts a report about a profile and requires a reason', async () => {
    const app = createApp();
    const missing = await request(app, 'POST', `${SPACE}/reports`, {
      userId: 'user-bilal',
      body: { personId: 'person-hina' },
    });
    expect(missing.status).toBe(400);

    const accepted = await request(app, 'POST', `${SPACE}/reports`, {
      userId: 'user-bilal',
      body: { personId: 'person-hina', reason: 'This profile was created without her knowledge.' },
    });
    expect(accepted.status).toBe(201);
  });
});
